// sendTwoDayReminders.js
// Usage: const { sendGameReminders } = require('./sendTwoDayReminders');
// await sendGameReminders();
if(process.env.NODE_ENV !== 'production'){
    require('dotenv').config()
}
console.log(process.env.NO_REPLY_EMAIL)
// const {getPool} = require('../db'); // your mssql pool factory
const functions = require('../helpers/functions'); // has sendEmail(body, toEmail, fromText, subject)
const sql = require('mssql'); // make sure mssql is installed and pool is compatible
// const pool = await getPool()
// ------- Utilities -------
function formatDateTimeMs(ms, timeZone = undefined) {
  // format like: "Mon, Jan 1 2025, 7:30 PM"
  const date = new Date(Number(ms));
  const opts = {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  };
  if (timeZone) opts.timeZone = timeZone;
  return new Intl.DateTimeFormat('en-US', opts).format(date);
}

function isoDateFromParts(year, month, day) {
  // return yyyy-mm-dd
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

function htmlEscape(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// ------- Main function -------
async function sendGameReminders({
  fromText = 'No Reply - GLOS',
  subjectPrefix = 'Games Reminder',
  timeZone = undefined, // if you want explicit timezone like 'America/Detroit', set it. See notes below.
  daysOut = 2,
} = {}) {
  // Compute start and end milliseconds for the target day (two days from today).
  // NOTE: This implementation uses the server's local timezone to determine "today".
  // If you need strict America/Detroit handling regardless of server timezone, see Luxon example below.
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysOut, 0, 0, 0, 0); // midnight two days out (server tz)
  const startMs = target.getTime();
  const endMs = new Date(target.getFullYear(), target.getMonth(), target.getDate() + 1).getTime();

  // If you want to debug:
  // console.log('Target day start (ms):', startMs, new Date(startMs).toString());

  // SQL: return one row per user-per-game for games on that day
  const sqlQuery = `
    SELECT
      ut.userId,
      u.email,
      u.preferredName,
      ut.teamId AS userTeamId,
      g.startUnixTime,
      g.location,
      g.Team1_ID,
      g.Team2_ID,
      t1.fullName AS Team1Name,
      t2.fullName AS Team2Name,
      l.abbreviation AS leagueAbbrev,
      g.season
    FROM games g
    INNER JOIN leagues l ON g.leagueId = l.leagueId
    LEFT JOIN teams t1 ON g.Team1_ID = t1.teamId
    LEFT JOIN teams t2 ON g.Team2_ID = t2.teamId
    INNER JOIN user_team ut
       ON (ut.teamId = g.Team1_ID OR ut.teamId = g.Team2_ID)
       AND ut.seasonId = g.season
    INNER JOIN users u ON ut.userId = u.ID
    WHERE g.startUnixTime >= @startMs AND g.startUnixTime < @endMs
    ORDER BY u.ID, g.startUnixTime;
  `;

  let request;
  try {
    // const conn = await pool(); // assuming pool() returns an active connection/Pool
    const config = {
    server: process.env.DB_SERVER,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    trustServerCertificate: true,
    options: {
        encrypt: true,
        connectionTimeout: 30000,
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
        },
      },
};
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    request = pool.request();
    request.input('startMs', sql.BigInt, startMs);
    request.input('endMs', sql.BigInt, endMs);

    const result = await request.query(sqlQuery);
    const rows = result.recordset || [];

    if (!rows.length) {
      console.log('No games found for target day.');
      return { sent: 0, found: 0 };
    }

    // Group rows by userId
    const usersMap = new Map();
    for (const r of rows) {
      const uid = r.userId;
      if (!usersMap.has(uid)) {
        usersMap.set(uid, { email: r.email, preferredName: r.preferredName || '', games: [] });
      }
      usersMap.get(uid).games.push(r);
    }

    // For each user, construct email
    let sentCount = 0;
    for (const [userId, userInfo] of usersMap.entries()) {
      // sort their games by startUnixTime (should already be ordered but ensure)
      userInfo.games.sort((a,b) => Number(a.startUnixTime) - Number(b.startUnixTime));

      // Build HTML body
      const displayName = htmlEscape(userInfo.preferredName || 'Player');
      const targetDateStr = formatDateTimeMs(startMs, timeZone).split(',')[1]?.trim() || new Date(startMs).toDateString();

      // table header
      let body = `
        <p>Hi ${displayName},</p>
        <p>Here are your games for <strong>${htmlEscape(targetDateStr)}</strong>:</p>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;">
          <thead>
            <tr>
              <th>Time</th>
              <th>Date</th>
              <th>Field / Court</th>
              <th>Your Team</th>
              <th>Opponent</th>
              <th>League</th>
            </tr>
          </thead>
          <tbody>
      `;

      for (const g of userInfo.games) {
        const ms = Number(g.startUnixTime);
        // If userTeamId equals Team1_ID then their team is Team1Name else Team2Name
        const userIsTeam1 = Number(g.userTeamId) === Number(g.Team1_ID);
        const teamName = userIsTeam1 ? g.Team1Name || `Team ${g.Team1_ID}` : g.Team2Name || `Team ${g.Team2_ID}`;
        const oppName = userIsTeam1 ? (g.Team2Name || `Team ${g.Team2_ID}`) : (g.Team1Name || `Team ${g.Team1_ID}`);
        const timeStr = (new Date(ms)).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timeZone });
        const dateStr = (new Date(ms)).toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric', timeZone: timeZone });

        body += `
          <tr>
            <td>${htmlEscape(timeStr)}</td>
            <td>${htmlEscape(dateStr)}</td>
            <td>${htmlEscape(g.location || '')}</td>
            <td>${htmlEscape(teamName || '')}</td>
            <td>${htmlEscape(oppName || '')}</td>
            <td>${htmlEscape(g.leagueAbbrev || '')}</td>
          </tr>
        `;
      }

      body += `
          </tbody>
        </table>
        <p>Good luck!</p>
      `;

      const subject = `${subjectPrefix} — ${targetDateStr}`;

      try {
        await functions.sendEmail(body, userInfo.email, fromText, subject, process.env.NO_REPLY_EMAIL, process.env.NO_REPLY_EMAIL_PASSWORD);
        sentCount++;
      } catch (e) {
        console.error(`Failed to send email to ${userInfo.email}:`, e && e.message ? e.message : e);
        // continue sending others
      }
    }
    await pool.close();

    console.log(`Emails sent: ${sentCount}`);
    return { sent: sentCount, found: usersMap.size };
  } catch (err) {
    console.error('Error sending reminders:', err);
    throw err;
  } finally {
    // do not close global pool here if pool is shared; if pool() returns a fresh connection you may close
  }
}
sendGameReminders({daysOut: 2})
// module.exports = { sendGameReminders };
