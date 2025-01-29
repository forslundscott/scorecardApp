// const functions = require('./helpers/functions');
const BYE = 1
const PLAYEVERYWEEK = 2
let teamData = [
    ['CFC','CFC',5],
    ['FCF','FCF',4],
    ['FTK','FTK',3],
    ['OVO','OVO',2],
    ['TOG','TOG',1],
    ['HON','HON',3]
    ,['BSG','BSG',2]
    // ,['CTM','CTM',5]
    // ,['DSC','DSC',4]
]
class game {
    constructor(){
        this.date = ''
        this.opponent = ''
        this.time = ''
    }
}
class scheduleList{
    constructor(){
        this.keys = [
            'Start_Date',
            'Start_Time',
            'End_Date',
            'End_Time',
            'Title',
            'Location',
            'All_Day_Event',
            'Event_Type',
            'Team1_ID',
            'Team2_ID',
            'Custom_Opponent'
        ]
        this.scheduleItems = []
    }
}
class scheduleItem{
    constructor(){
        this.Start_Date = ''
        this.Start_Time = ''
        this.End_Date = ''
        this.End_Time = ''
        this.Title = ''
        this.Location = 'AC3 Gym'
        this.All_Day_Event = 0
        this.Event_Type = 'Game'
        this.Team1_ID = ''
        this.Team1_Is_Home = 1
        this.Team2_ID = ''
        this.Custom_Opponent = 0
    }
}
class round{
    constructor(){
        this.mathes = []
        this.teams = []
        this.ids = []
    }
}

class team{
    constructor(){
        this.id = ''
        this.name = ''
        this.rating = 3
        this.gamesPlayed = 0
    }
}
class player{
    constructor(){
        this.firstName = ''
        this.lastName = ''
        this.email = ''
        this.team = ''
    }
}

class match{
    constructor(){
        this.teams = []
        this.ids = []
        this.matchDelta = 0
    }
}

function moveToEnd(array,element){
    let tempArray = [...array]
    let splicedElement = tempArray.splice(tempArray.indexOf(element), 1)
    tempArray.push(splicedElement[0])
    return tempArray
}

function makeLeague(teams,gamesPerTeam,teamsPerLeague,leagueId,subLeagueId,dayOfWeek){
    let league = {
        teams:[],
        playoffs: false,
        possibleMatches: getMatches(teams),
        leagueId: leagueId,
        subLeagueId: subLeagueId,
        totalRegularSeasonGames: (teams.length*gamesPerTeam)/2,
        totalPlayoffGames: 0,
        scheduleMatches: [],
        playoffMatches:[],
        teamsPlayed: [],
        regularSeasonGamesPerTeam: gamesPerTeam,
        dayOfWeek: dayOfWeek
    }
    // console.log(leagueId&&subLeagueId)
    for(let j=0;j<teamsPerLeague;j++){
        league.teams.push(teams[j])
        // teams.shift()
    }
    if(gamesPerTeam%(league.teams.length-1)!==0){
        league.playoffs = true
        league.regularSeasonGamesPerTeam = gamesPerTeam-2
        league.totalPlayoffGames = league.teams.length
        league.totalRegularSeasonGames = (league.regularSeasonGamesPerTeam*league.teams.length)/2
    }
    return league
}
function leagueSplit(leagues,gamesPerTeam){
    // let teams = teams
    let leagueList = []
    for(let league of leagues){
        // console.log(league.leagueId)
        let opponentCount = league.teams.length - 1
        let leagueCount = Math.ceil(opponentCount/gamesPerTeam)
        let teamsPerLeague = league.teams.length / leagueCount
        let lrgLeaguesCount= ((teamsPerLeague) - Math.floor(teamsPerLeague))*leagueCount
        
        for(let i=0;i<leagueCount;i++){
            if(i<lrgLeaguesCount){
                // Leagues with extra game
                leagueList.push(makeLeague(league.teams,gamesPerTeam,Math.ceil(teamsPerLeague),league.leagueId,i+1,league.dayOfWeek))
            }else{   
                leagueList.push(makeLeague(league.teams,gamesPerTeam,Math.floor(teamsPerLeague),league.leagueId,i+1,league.dayOfWeek))
            }
        }
    }    
    return leagueList
}

function leagueSchedule(leagues,gamesPerTeam){
    let subLeagues = leagueSplit(leagues,gamesPerTeam)
    // console.log(subLeagues)
    for(const subLeague of subLeagues){
        for(let i=0;i<subLeague.totalRegularSeasonGames;i++){
            for(let j = 0; j< subLeague.possibleMatches.length;j++){
                let match = subLeague.possibleMatches[j]
                let minGamesPlayed = Math.min(...subLeague.teams.map(obj => obj.gamesPlayed))
                let avGamesPlayed = (subLeague.teams.reduce((accumulator, currentValue) => {
                    return accumulator + currentValue.gamesPlayed;
                }, 0))/subLeague.teams.length
                // the following ensures that neither team has already played their max number of games and makes sure at least one team has played the least number of games so far
                if(match.teams[0].gamesPlayed!= subLeague.regularSeasonGamesPerTeam 
                    && match.teams[1].gamesPlayed!= subLeague.regularSeasonGamesPerTeam 
                    && !(match.teams[0].gamesPlayed>minGamesPlayed && match.teams[1].gamesPlayed>minGamesPlayed)
                    && !(avGamesPlayed<((match.teams[0].gamesPlayed + match.teams[1].gamesPlayed)/2))
                ){
                    // if(subLeague.leagueId ==='OCO2'){
                    //     console.log(`${minGamesPlayed} ${match.teams[0].id}: ${match.teams[0].gamesPlayed} ${match.teams[1].id}: ${match.teams[1].gamesPlayed} ${(match.teams[0].gamesPlayed + match.teams[1].gamesPlayed)/2} ${avGamesPlayed}`)}
                    match.teams[0].gamesPlayed +=1
                    match.teams[1].gamesPlayed +=1
                    // console.log({team1Id: match.teams[0].id,team2Id: match.teams[1].id})
                    subLeague.scheduleMatches.push(
                        {gameNumber: subLeague.scheduleMatches.length +1
                            ,type: 'R'
                            ,team1Id: match.teams[0].id
                            ,team2Id: match.teams[1].id
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null
                            ,Team1Ranking: null 
                            ,Team2Ranking: null
                        }
                    )
                    subLeague.possibleMatches = moveToEnd(subLeague.possibleMatches,match)
                    break
                }
                // if playoffs subtract 2 from games/team
            }
        }
        // console.log(subLeague.teams);
        // subLeague.teams.forEach(item =>{
        //     console.log(`${item.id }: ${item.gamesPlayed}`)
        // })
        let playOffSchedule = []
        let tempStr = ''
        // round 1
        let firstRounGames = Math.floor(subLeague.totalPlayoffGames/2)
        for(let i=0;i<firstRounGames;i++){
            // if(subLeague.teams.length%2===0){
                // evens
                if(i+1==Math.floor(subLeague.teams.length/2) && subLeague.teams.length%2===0){
                    tempStr = `Game ${Math.floor(subLeague.teams.length/2)}: ${subLeague.teams[0].id} vs ${subLeague.teams[subLeague.teams.length-1].id}`
                    subLeague.playoffMatches.push(
                        {gameNumber: Math.floor(subLeague.teams.length/2),
                        type: 'P', 
                        team1Id: 'TBD'
                            ,team2Id: 'TBD'
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null,
                        Team1Ranking: 1, 
                        Team2Ranking: subLeague.teams.length}
                    )
                    playOffSchedule.push(tempStr)
                    // console.log(tempStr)
                }else{
                    tempStr = `Game ${i+1}: ${subLeague.teams[(2*i)+1].id} vs ${subLeague.teams[(2*i)+2].id}`
                    // console.log(`Game ${i+1}:`)
                    subLeague.playoffMatches.push(
                        {gameNumber: i+1,
                            type: 'P', 
                            team1Id: 'TBD'
                            ,team2Id: 'TBD'
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null,
                            Team1Ranking: (2*i)+2, 
                            Team2Ranking: (2*i)+3}
                    )
                    playOffSchedule.push(tempStr)
                    // console.log(tempStr)
                }
            // }else{
            //     // odds
                
            // }
        }
        // round 2
        
        for(let i=0;i<subLeague.totalPlayoffGames - firstRounGames;i++){
            if(i==0){
                tempStr = `Game ${subLeague.playoffMatches.length+1}: ${subLeague.teams[0].id} vs Winner of ${subLeague.playoffMatches[0].gameNumber}`
                subLeague.playoffMatches.push(
                    {gameNumber: subLeague.playoffMatches.length+1,
                        type: 'P', 
                        team1Id: 'TBD'
                            ,team2Id: 'TBD'
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null,
                        Team1Ranking: 1, 
                        Team2Ranking: `Winner of ${subLeague.playoffMatches[0].gameNumber}`}
                )
                playOffSchedule.push(tempStr)
                // console.log(tempStr)
            // }else if(i+1==firstRounGames && subLeague.teams.length%2!==0){
            //     tempStr = `Game ${subLeague.teams.length}: ${subLeague.teams[subLeague.teams.length-1].id} vs Loser of ${playOffSchedule[playOffSchedule.length-2]}`
            //     playOffSchedule.push(tempStr)
            //     console.log(tempStr)
            }else if(i+1==firstRounGames){
                if(subLeague.teams.length%2===0){
                    // even
                    tempStr = `Game ${subLeague.teams.length}: ${subLeague.teams[subLeague.teams.length-1].id} vs Loser of ${subLeague.playoffMatches[subLeague.playoffMatches.length-2].gameNumber}`
                    subLeague.playoffMatches.push(
                        {gameNumber: subLeague.teams.length,
                            type: 'P', 
                            team1Id: 'TBD'
                            ,team2Id: 'TBD'
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null,
                            Team1Ranking: subLeague.teams.length, 
                            Team2Ranking: `Loser of ${subLeague.playoffMatches[firstRounGames-2].gameNumber}`}
                    )
                    playOffSchedule.push(tempStr)
                    // console.log(tempStr)
                }else{
                    // odd
                    tempStr = `Game ${subLeague.playoffMatches.length+1}: ${subLeague.teams[0].id} vs Loser of ${subLeague.playoffMatches[subLeague.playoffMatches.length-1].gameNumber}`
                    subLeague.playoffMatches.push(
                        {gameNumber: subLeague.playoffMatches.length+1,
                            type: 'P', 
                            team1Id: 'TBD'
                            ,team2Id: 'TBD'
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null,
                            Team1Ranking: 1, 
                            Team2Ranking: `Loser of ${subLeague.playoffMatches[subLeague.playoffMatches.length-1].gameNumber}`}
                    )
                    playOffSchedule.push(tempStr)
                    // console.log(tempStr)
                }
            }else{
                tempStr = `Game ${subLeague.playoffMatches.length+1}: Winner of ${subLeague.playoffMatches[i].gameNumber} vs Loser of ${subLeague.playoffMatches[i-1].gameNumber}`
                // console.log(`Game ${i+1}:`)
                subLeague.playoffMatches.push(
                    {gameNumber: subLeague.playoffMatches.length+1,
                        type: 'P', 
                        team1Id: 'TBD'
                            ,team2Id: 'TBD'
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null,
                        Team1Ranking: `Winner of ${subLeague.playoffMatches[i].gameNumber}`, 
                        Team2Ranking: `Loser of ${subLeague.playoffMatches[i-1].gameNumber}`}
                )
                playOffSchedule.push(tempStr)
                // console.log(tempStr)
            }
        }
        // console.log(subLeague.playoffMatches)
    }
    // console.log(subLeagues[1])
    return subLeagues
}

function leagueScheduleOld(leagues,gamesPerTeam){
    let subLeagues = leagueSplit(leagues,gamesPerTeam)
    // console.log(subLeagues)
    for(const subLeague of subLeagues){
        for(let i=0;i<subLeague.totalRegularSeasonGames;i++){
            for(let j = 0; j< subLeague.possibleMatches.length;j++){
                let match = subLeague.possibleMatches[j]
                let minGamesPlayed = Math.min(...subLeague.teams.map(obj => obj.gamesPlayed))
                let avGamesPlayed = (subLeague.teams.reduce((accumulator, currentValue) => {
                    return accumulator + currentValue.gamesPlayed;
                }, 0))/subLeague.teams.length
                // the following ensures that neither team has already played their max number of games and makes sure at least one team has played the least number of games so far
                if(match.teams[0].gamesPlayed!= subLeague.regularSeasonGamesPerTeam 
                    && match.teams[1].gamesPlayed!= subLeague.regularSeasonGamesPerTeam 
                    && !(match.teams[0].gamesPlayed>minGamesPlayed && match.teams[1].gamesPlayed>minGamesPlayed)
                    && !(avGamesPlayed<((match.teams[0].gamesPlayed + match.teams[1].gamesPlayed)/2))
                ){
                    // if(subLeague.leagueId ==='OCO2'){
                    //     console.log(`${minGamesPlayed} ${match.teams[0].id}: ${match.teams[0].gamesPlayed} ${match.teams[1].id}: ${match.teams[1].gamesPlayed} ${(match.teams[0].gamesPlayed + match.teams[1].gamesPlayed)/2} ${avGamesPlayed}`)}
                    match.teams[0].gamesPlayed +=1
                    match.teams[1].gamesPlayed +=1
                    // console.log({team1Id: match.teams[0].id,team2Id: match.teams[1].id})
                    subLeague.scheduleMatches.push(
                        {gameNumber: subLeague.scheduleMatches.length +1
                            ,type: 'R'
                            ,team1Id: match.teams[0].id
                            ,team2Id: match.teams[1].id
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null
                            ,Team1Ranking: null 
                            ,Team2Ranking: null
                        }
                    )
                    subLeague.possibleMatches = moveToEnd(subLeague.possibleMatches,match)
                    break
                }
                // if playoffs subtract 2 from games/team
            }
        }
        // console.log(subLeague.teams);
        // subLeague.teams.forEach(item =>{
        //     console.log(`${item.id }: ${item.gamesPlayed}`)
        // })
        let playOffSchedule = []
        let tempStr = ''
        // round 1
        let firstRounGames = Math.floor(subLeague.totalPlayoffGames/2)
        for(let i=0;i<firstRounGames;i++){
            // if(subLeague.teams.length%2===0){
                // evens
                if(i+1==Math.floor(subLeague.teams.length/2) && subLeague.teams.length%2===0){
                    tempStr = `Game ${Math.floor(subLeague.teams.length/2)}: ${subLeague.teams[0].id} vs ${subLeague.teams[subLeague.teams.length-1].id}`
                    subLeague.playoffMatches.push(
                        {gameNumber: Math.floor(subLeague.teams.length/2),
                        type: 'P', 
                        team1Id: 'TBD'
                            ,team2Id: 'TBD'
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null,
                        Team1Ranking: 1, 
                        Team2Ranking: subLeague.teams.length}
                    )
                    playOffSchedule.push(tempStr)
                    // console.log(tempStr)
                }else{
                    tempStr = `Game ${i+1}: ${subLeague.teams[(2*i)+1].id} vs ${subLeague.teams[(2*i)+2].id}`
                    // console.log(`Game ${i+1}:`)
                    subLeague.playoffMatches.push(
                        {gameNumber: i+1,
                            type: 'P', 
                            team1Id: 'TBD'
                            ,team2Id: 'TBD'
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null,
                            Team1Ranking: (2*i)+2, 
                            Team2Ranking: (2*i)+3}
                    )
                    playOffSchedule.push(tempStr)
                    // console.log(tempStr)
                }
            // }else{
            //     // odds
                
            // }
        }
        // round 2
        
        for(let i=0;i<subLeague.totalPlayoffGames - firstRounGames;i++){
            if(i==0){
                tempStr = `Game ${subLeague.playoffMatches.length+1}: ${subLeague.teams[0].id} vs Winner of ${subLeague.playoffMatches[0].gameNumber}`
                subLeague.playoffMatches.push(
                    {gameNumber: subLeague.playoffMatches.length+1,
                        type: 'P', 
                        team1Id: 'TBD'
                            ,team2Id: 'TBD'
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null,
                        Team1Ranking: 1, 
                        Team2Ranking: `Winner of ${subLeague.playoffMatches[0].gameNumber}`}
                )
                playOffSchedule.push(tempStr)
                // console.log(tempStr)
            // }else if(i+1==firstRounGames && subLeague.teams.length%2!==0){
            //     tempStr = `Game ${subLeague.teams.length}: ${subLeague.teams[subLeague.teams.length-1].id} vs Loser of ${playOffSchedule[playOffSchedule.length-2]}`
            //     playOffSchedule.push(tempStr)
            //     console.log(tempStr)
            }else if(i+1==firstRounGames){
                if(subLeague.teams.length%2===0){
                    // even
                    tempStr = `Game ${subLeague.teams.length}: ${subLeague.teams[subLeague.teams.length-1].id} vs Loser of ${subLeague.playoffMatches[subLeague.playoffMatches.length-2].gameNumber}`
                    subLeague.playoffMatches.push(
                        {gameNumber: subLeague.teams.length,
                            type: 'P', 
                            team1Id: 'TBD'
                            ,team2Id: 'TBD'
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null,
                            Team1Ranking: subLeague.teams.length, 
                            Team2Ranking: `Loser of ${subLeague.playoffMatches[firstRounGames-2].gameNumber}`}
                    )
                    playOffSchedule.push(tempStr)
                    // console.log(tempStr)
                }else{
                    // odd
                    tempStr = `Game ${subLeague.playoffMatches.length+1}: ${subLeague.teams[0].id} vs Loser of ${subLeague.playoffMatches[subLeague.playoffMatches.length-1].gameNumber}`
                    subLeague.playoffMatches.push(
                        {gameNumber: subLeague.playoffMatches.length+1,
                            type: 'P', 
                            team1Id: 'TBD'
                            ,team2Id: 'TBD'
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null,
                            Team1Ranking: 1, 
                            Team2Ranking: `Loser of ${subLeague.playoffMatches[subLeague.playoffMatches.length-1].gameNumber}`}
                    )
                    playOffSchedule.push(tempStr)
                    // console.log(tempStr)
                }
            }else{
                tempStr = `Game ${subLeague.playoffMatches.length+1}: Winner of ${subLeague.playoffMatches[i].gameNumber} vs Loser of ${subLeague.playoffMatches[i-1].gameNumber}`
                // console.log(`Game ${i+1}:`)
                subLeague.playoffMatches.push(
                    {gameNumber: subLeague.playoffMatches.length+1,
                        type: 'P', 
                        team1Id: 'TBD'
                            ,team2Id: 'TBD'
                            ,leagueId: subLeague.leagueId
                            ,subLeagueId: subLeague.subLeagueId
                            ,dayOfWeek: subLeague.dayOfWeek
                            ,startDate: null
                            ,startTime: null,
                        Team1Ranking: `Winner of ${subLeague.playoffMatches[i].gameNumber}`, 
                        Team2Ranking: `Loser of ${subLeague.playoffMatches[i-1].gameNumber}`}
                )
                playOffSchedule.push(tempStr)
                // console.log(tempStr)
            }
        }
        // console.log(subLeague.playoffMatches)
    }
    // console.log(subLeagues[1])
    return subLeagues
}



function compare( a, b ) {
    if ( a.matchDelta < b.matchDelta ){
      return -1;
    }
    if ( a.matchDelta > b.matchDelta ){
      return 1;
    }
    return 0;
}

function getMatches(teams){
    let matchList = []
    
    for(let i=0;i<teams.length-1;i++){
        for(let j=i+1;j<teams.length;j++){
            let currentMatch = new match
            currentMatch.teams.push(teams[i])
            currentMatch.teams.push(teams[j])
            currentMatch.ids.push(teams[i].id)
            currentMatch.ids.push(teams[j].id)
            currentMatch.matchDelta = Math.abs(teams[i].rating-teams[j].rating)
            matchList.push(currentMatch)
        }
    }
    matchList.sort( compare )
    return matchList
}
// function getTeams(){
//     let teamList = []
//     for(const xteam of teamData){
//         // if(teamRows[i].style.display !== 'none'){
//             let currentTeam = new team
//             currentTeam.name = xteam[0]
//             currentTeam.id = xteam[1]
//             currentTeam.rating = Math.random()*5
//             teamList.push(currentTeam)
//         // }
//     }
//     return teamList
// }
module.exports = {leagueSchedule}