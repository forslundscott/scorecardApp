const audio = new Audio()
let gameInfo
if(sessionStorage.gameInfo == 'undefined' || sessionStorage.gameInfo == '' || sessionStorage.gameInfo == null) {
    gameInfo = {
        period: 1,
        time: '15:00',
        timerButtonState: 'Start',
        touchTime: Date.now()
    }

}else {
    gameInfo = JSON.parse(sessionStorage.gameInfo)

}

window.addEventListener('beforeunload', (event) => {
    sessionStorage.setItem('gameInfo',JSON.stringify(gameInfo))
  });

document.addEventListener('DOMContentLoaded', function () {
    const eles = document.getElementsByClassName('dragColumn')
    
    for(let ele of eles){
        setDragScroll(ele)
    }
});

document.addEventListener('click', function enableAudio() {
    document.removeEventListener('click', enableAudio, false);
    audio.autoplay= true;
}, false);
function setDragScroll(ele){
    ele.style.cursor = 'grab';

    let pos = { top: 0, left: 0, x: 0, y: 0 };

    const mouseDownHandler = function (e) {
        ele.style.cursor = 'grabbing';
        ele.style.userSelect = 'none';

        pos = {
            left: ele.scrollLeft,
            top: ele.scrollTop,
            // Get the current mouse position
            x: e.clientX,
            y: e.clientY,
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        ele.addEventListener('ontouchmove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
        ele.addEventListener('ontouchend', mouseUpHandler);
    };

    const mouseMoveHandler = function (e) {
        // How far the mouse has been moved
        const dx = e.clientX - pos.x;
        const dy = e.clientY - pos.y;

        // Scroll the element
        ele.scrollTop = pos.top - dy;
        ele.scrollLeft = pos.left - dx;
    };

    const mouseUpHandler = function () {
        ele.style.cursor = 'grab';
        ele.style.removeProperty('user-select');

        document.removeEventListener('mousemove', mouseMoveHandler);
        ele.removeEventListener('ontouchmove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
        ele.removeEventListener('ontouchend', mouseUpHandler);
    };

    // Attach the handler
    ele.addEventListener('mousedown', mouseDownHandler);
    ele.addEventListener('ontouchstart', mouseDownHandler);
}

if(document.getElementById('timerForm')){
    let distance = Number(document.getElementById('timerForm').querySelector('[name="timerTime"]').value)
    let x = setInterval(async function() {
    ;
    
    if(document.getElementById('timerForm').querySelector('[name="timerState"]').value == 1){
        distance = distance - 1000;
        if (distance < 0) {   
            clearInterval(x);
                playSoundAndWait('whistle.mp3')
                async function playSoundAndWait(soundFilePath) {
                    let form = document.getElementById('timerForm')
                        let formData = new FormData(form)
                    await fetch('/games/periodEnd', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                        },
                        body: new URLSearchParams(formData).toString(),
                    });
                    if(audio.autoplay == true){
                        audio.src = soundFilePath
                        // Set up an event listener for the 'ended' event
                        audio.addEventListener('ended', function() {
                            
                            location.reload()
                        });
                        // Play the audio
                        audio.play();
                    }else{
                        location.reload()
                    }
                }            
        } else{
            let minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
            let seconds = Math.floor((distance % (1000 * 60)) / 1000).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
            document.getElementById("gameTimer").innerHTML = minutes + ":" + seconds;
        }
    }
  }, 1000);
} 
  function timerStartStop(ele){
    switch(true){
        case ele.form.querySelector('[name="timerState"]').value == 0 :
            ele.form.querySelector('[name="timerState"]').value= 1
            break
        case ele.form.querySelector('[name="timerState"]').value == 1 :
            ele.form.querySelector('[name="timerState"]').value= 0
            break
    } 
  }
  async function statHandler(ele,xperiod,val = 1){
    let form = ele.form
        form.querySelector('[name="realTime"]').value = Date.now()
        form.querySelector('[name="value"]').value = val
        form.querySelector('[name="period"]').value = xperiod
        form.querySelector('[name="periodTime"]').value = document.getElementById('gameTimer').innerText
        form.querySelector('[name="type"]').value = ele.value
        let formData = new FormData(form)
        try{
            const response = await fetch('/games/eventLog', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams(formData).toString(),
            });
            if (response.ok) {
                const responseData = await response.json();
                switch(responseData.message){
                    case 'Reload':
                        location.reload()
                        break
                    default:
                        document.getElementById(responseData.data.player.userId + responseData.data.player.teamId).getElementsByClassName('goals')[0].innerHTML = 'G: ' + responseData.data.player.goals
                        document.getElementById(responseData.data.player.userId + responseData.data.player.teamId).getElementsByClassName('assists')[0].innerHTML = 'A: ' + responseData.data.player.assists
                        document.getElementById(responseData.data.player.userId + responseData.data.player.teamId).getElementsByClassName('saves')[0].innerHTML = 'Sv: ' + responseData.data.player.saves
                        document.getElementById(responseData.data.team1.team + 'Score').innerHTML = responseData.data.team1.score
                        document.getElementById(responseData.data.team2.team + 'Score').innerHTML = responseData.data.team2.score
                        closeForm()
                }
            } else {
                console.error('Form submission failed');
            }
        }catch(error){
            console.error('Error:', error);
        }
  }
let isDown = false,
isLong = false,
target,                                         // which element was clicked
longTID;
function handleMouseDown(ele, e) {
  isDown = true;                                    // button status (any button here)
  isLong = false;                                   // longpress status reset
  target = this;                                    // store this as target element
  longTID = setTimeout(longPress, 500, ele, e); // create a new timer for this click
};

function handleMouseUp(e) {
  if (isDown && isLong) {                           // if a long press, cancel
    isDown = false;                                 // clear in any case
    e.preventDefault();                             // and ignore this event
    return
  }
  
  if (isDown) {                                     // if we came from down status:
      clearTimeout(longTID);                        // clear timer to avoid false longpress
      isDown = false;
      target = null;
  }
};

function longPress(ele,e) {
    let eles = ele.parentElement.getElementsByClassName('floatingActionButtons')
    ele.parentElement.classList.add('floating')
    eles[0].classList.replace('hidden','block')
    eles[1].classList.replace('hidden','block')
    document.getElementById('floatingBackground').classList.remove('hidden')
    isLong = true;
}
function handleLongPress(e){
    if(isLong){
        return false
    }
}

function toggleAddPlayer(xform){
    if(document.getElementById('newPlayerForm').style.display == 'none'){
        document.getElementById('newPlayerForm').style.display = ''
        document.getElementById('newPlayerForm').querySelector('[name="teamId"]').value = xform.querySelector('[name="teamId"]').value
        document.getElementById('newPlayerForm').querySelector('[name="seasonId"]').value = xform.querySelector('[name="seasonId"]').value
        document.getElementById('newPlayerForm').querySelector('[name="eventId"]').value = xform.querySelector('[name="eventId"]').value
        document.getElementById('newPlayerLogo').src = `/images/${xform.querySelector('[name="teamId"]').value}.png`
    }else{
        document.getElementById('newPlayerForm').style.display = 'none'
    }
    if(document.getElementById('teamFormBackground').style.display == 'none'){
        document.getElementById('teamFormBackground').style.display = ''
    }else{
        document.getElementById('teamFormBackground').style.display = 'none'
    }
}
function toggleSearchUser(){
    let searchForm = document.getElementById('userSearchContainer')
    if(searchForm.style.display == 'none'){
        searchForm.style.display = ''
    }else{
        searchForm.style.display = 'none'
        document.getElementById('userSearchResults').innerHTML = ''
    }
    
}
function toggleSearchPlayer(){
    let searchForm = document.getElementById('playerSearchContainer')
    if(searchForm.style.display == 'none'){
        searchForm.style.display = ''
    }else{
        searchForm.style.display = 'none'
        document.getElementById('playerSearchResults').innerHTML = ''
    }
    
}
async function userSearch(xForm,event){

        event.preventDefault();
        try {

            let formData = new FormData(xForm)
            const response = await fetch(`/users/userSearch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                  },
                body: new URLSearchParams(formData).toString(),
              });

            
            if (response.ok) {
                const results = await response.json();
                const resultsList = document.getElementById('userSearchResults');
                resultsList.innerHTML = '';
                results.forEach(user => {
                    const userCard = `
                        <form class="" action="/${window.location.pathname.replace(/\//g, '')}/${user.ID}" method="get">
                            <button type="submit" class="playerButton">
                            <div class="itemFormat primaryStyle primaryBorder">
                                <div class="playerTag">
                                    <div class="playerName" style="text-align: center;">
                                        ${user.firstName} ${user.lastName} - ${user.preferredName} - ${user.email}
                                    </div>
                                </div>                
                            </div>
                            </button>
                        </form>
                    `
                    resultsList.innerHTML += userCard
            });
              } else {
                console.error('Form submission failed');
              }
            
            
        } catch (error) {
            console.error('Error fetching results:', error);
        }

}
async function playerSearch(xForm,event){

    event.preventDefault();
    try {

        let formData = new FormData(xForm)
        const response = await fetch(`/games/playerSearch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            body: new URLSearchParams(formData).toString(),
          });

        
        if (response.ok) {
            const results = await response.json();
            const resultsList = document.getElementById('playerSearchResults');
            resultsList.innerHTML = '';
            results.forEach(user => {
                const userCard = `
                    <form class="" action="" method="post">
                        <input type="hidden" name="email" value="${user.email}">
                        <input type="hidden" name="firstName" value="${user.firstName}">
                        <input type="hidden" name="lastName" value="${user.lastName}">
                        <input type="hidden" name="preferredName" value="${user.preferredName}">
                        <input type="hidden" name="shirtSize" value="${user.shirtSize}">
                        <input type="hidden" name="discounted" value="${user.discounted}">
                        <button type="button" class="playerButton" name="type" value="game" onclick="selectPlayer(this.form)">
                        <div class="itemFormat primaryStyle primaryBorder">
                            <div class="playerTag">
                                <div class="playerName" style="text-align: center;">
                                    ${user.firstName} ${user.lastName} - ${user.preferredName} - ${user.email}
                                </div>
                            </div>                
                        </div>
                        </button>
                    </form>
                `
                resultsList.innerHTML += userCard
        });
          } else {
            console.error('Form submission failed');
          }
        
        
    } catch (error) {
        console.error('Error fetching results:', error);
    }

}
async function teamSearch(xForm,event){

    event.preventDefault();
    try {

        let formData = new FormData(xForm)
        const response = await fetch(`/teams/teamSearch`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            body: new URLSearchParams(formData).toString(),
          });

        
        if (response.ok) {
            const results = await response.json();
            const resultsList = document.getElementById('teamSearchResults');
            resultsList.innerHTML = '';
            results.forEach(team => {
                const teamCard = `
                    <form class="" action="" method="post">
                        <input type="hidden" name="teamId" value="${team.teamId}">
                        <input type="hidden" name="fullName" value="${team.fullName}">
                        <input type="hidden" name="shortName" value="${team.shortName}">
                        <input type="hidden" name="abbreviation" value="${team.abbreviation}">
                        <button type="button" class="playerButton" name="type" value="game" onclick="insertExistingTeamInfo(this.form)">
                        <div class="itemFormat primaryStyle primaryBorder">
                            <div class="playerTag">
                                <div class="playerName" style="text-align: center;">
                                    ${team.fullName} - ${team.abbreviation}
                                </div>
                            </div>                
                        </div>
                        </button>
                    </form>
                `
                resultsList.innerHTML += teamCard
        });
          } else {
            console.error('Form submission failed');
          }
        
        
    } catch (error) {
        console.error('Error fetching results:', error);
    }

}
function togglePaidCheckbox() {
    const checkboxContainer = document.getElementById('paidContainer');
    const radioButtons = document.getElementsByName('playerType');

    for (const radioButton of radioButtons) {
        if (radioButton.checked) {
            if (radioButton.value === 'Rostered') {
                checkboxContainer.style.display = '';
                document.getElementById('paid').required = true
            } else {
                checkboxContainer.style.display = 'none';
                document.getElementById('paid').required = false
            }
        }
    }
}
function selectPlayer(xform){
    let newPlayerForm
    console.log(window.location.href)
    if(window.location.href.includes('activeGame')){
        newPlayerForm = document.getElementById('newPlayerForm')
        newPlayerForm.querySelector('[name="waiver"]').checked = true
    }else if(window.location.href.includes('roster/newPlayer')){
        newPlayerForm = document.getElementById('newRosterPlayerForm')
        newPlayerForm.querySelector('[name="waiver"]').checked = true
    }else if(window.location.href.includes('registration/team')){
        newPlayerForm = document.getElementById('newPlayerFormTeamRegistration')
        newPlayerForm.querySelector('[name="shirtSize"]').value = xform.querySelector('[name="shirtSize"]').value
        newPlayerForm.querySelector('[name="discounted"]').value = xform.querySelector('[name="discounted"]').value
    }
        newPlayerForm.querySelector('[name="email"]').value = xform.querySelector('[name="email"]').value
        newPlayerForm.querySelector('[name="firstName"]').value = xform.querySelector('[name="firstName"]').value
        newPlayerForm.querySelector('[name="lastName"]').value = xform.querySelector('[name="lastName"]').value
        newPlayerForm.querySelector('[name="preferredName"]').value = xform.querySelector('[name="preferredName"]').value
        // newPlayerForm.querySelector('[name="waiver"]').checked = true
    
    toggleSearchPlayer()
}
function selectUser(xform){

    const newPlayerForm = document.getElementById('newPlayerForm')
    newPlayerForm.querySelector('[name="email"]').value = xform.querySelector('[name="email"]').value
    newPlayerForm.querySelector('[name="firstName"]').value = xform.querySelector('[name="firstName"]').value
    newPlayerForm.querySelector('[name="lastName"]').value = xform.querySelector('[name="lastName"]').value
    newPlayerForm.querySelector('[name="preferredName"]').value = xform.querySelector('[name="preferredName"]').value
    newPlayerForm.querySelector('[name="waiver"]').checked = true
    toggleSearchUser()
}
async function toggleTeamForm(xform){
    let teamForm = document.getElementById('teamForm')
    if(document.getElementById('formBackground').style.display == 'none'){
        document.getElementById('formBackground').style.display = ''
    }else{
        document.getElementById('formBackground').style.display = 'none'
    }
    if(teamForm.style.display == 'none'){
        teamForm.getElementsByClassName('playerName')[0].innerHTML = xform.querySelector('[name="teamName"]').value
        teamForm.style.display = ''
        teamForm.querySelector('[name="teamId"]').value = xform.querySelector('[name="teamId"]').value
        teamForm.querySelector('[name="seasonId"]').value = xform.querySelector('[name="seasonId"]').value
        teamForm.querySelector('[name="eventId"]').value = document.getElementById('timerForm').querySelector('[name="Event_ID"]').value
        teamForm.getElementsByClassName('formLogo')[0].src = `/images/${xform.querySelector('[name="teamId"]').value}.png`
    }else{
        teamForm.style.display = 'none'
    }
}
async function toggleGameInfoForm(xform){
    try{
        let formData = new FormData(xform)
        const response = await fetch('/games/gameInfo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            body: new URLSearchParams(formData).toString(),
          });
          if (response.ok) {
            const responseData = await response.json();
            if(document.getElementById('gameInfoForm').style.display == 'none'){
                let team1Select = document.getElementById('gameInfoForm').querySelector('[name="Team1_ID"]')
                let team2Select = document.getElementById('gameInfoForm').querySelector('[name="Team2_ID"]')
                let scoreKeeperSelect = document.getElementById('gameInfoForm').querySelector('[name="scoreKeeper_ID"]')
                let monitorSelect = document.getElementById('gameInfoForm').querySelector('[name="monitorId"]')
                let ref1Select = document.getElementById('gameInfoForm').querySelector('[name="ref1Id"]')
                let ref2Select = document.getElementById('gameInfoForm').querySelector('[name="ref2Id"]')
                document.getElementById('gameInfoForm').querySelector('[name="period"]').value=responseData.data.game.period
                while (team1Select.options.length > 1) {
                    team1Select.remove(1);
                  }
                while (team2Select.options.length > 1) {
                    team2Select.remove(1);
                }
                while (scoreKeeperSelect.options.length > 1) {
                    scoreKeeperSelect.remove(1);
                }
                while (monitorSelect.options.length > 1) {
                    monitorSelect.remove(1);
                }
                while (ref1Select.options.length > 1) {
                    ref1Select.remove(1);
                }
                while (ref2Select.options.length > 1) {
                    ref2Select.remove(1);
                }
                // console.log(responseData.data)
                responseData.data.teams.forEach(function(xoption) {
                    console.log(xoption.teamId)
                    let option = document.createElement("option");
                    option.text = xoption.abbreviation;
                    option.value = xoption.teamId;
                    team1Select.add(option);
                    option = document.createElement("option");
                    option.text = xoption.abbreviation;
                    option.value = xoption.teamId;
                    team2Select.add(option);
                  })
                  responseData.data.scoreKeepers.forEach(function(xoption) {
                    let option = document.createElement("option");
                    option.text = `${xoption.firstName} ${xoption.lastName} ${xoption.preferredName !== xoption.firstName ? '(' + xoption.preferredName + ')': ''}`;
                    option.value = xoption.userId;
                    scoreKeeperSelect.add(option);
                  })
                  responseData.data.monitors.forEach(function(xoption) {
                    let option = document.createElement("option");
                    option.text = `${xoption.firstName} ${xoption.lastName} ${xoption.preferredName !== xoption.firstName ? '(' + xoption.preferredName + ')': ''}`;
                    option.value = xoption.userId;
                    monitorSelect.add(option);
                  })
                  responseData.data.referees.forEach(function(xoption) {
                    let option = document.createElement("option");
                    option.text = `${xoption.firstName} ${xoption.lastName} ${xoption.preferredName !== xoption.firstName ? '(' + xoption.preferredName + ')': ''}`;
                    option.value = xoption.userId;
                    ref1Select.add(option);
                    option = document.createElement("option");
                    option.text = `${xoption.firstName} ${xoption.lastName} ${xoption.preferredName !== xoption.firstName ? '(' + xoption.preferredName + ')': ''}`;
                    option.value = xoption.userId;
                    ref2Select.add(option);
                  })
                //   responseData.data.referees.forEach(function(xoption) {
                //     let option = document.createElement("option");
                //     option.text = `${xoption.firstName} ${xoption.lastName} ${xoption.preferredName !== xoption.firstName ? '(' + xoption.preferredName + ')': ''}`;
                //     option.value = xoption.userId;
                //     ref2Select.add(option);
                //   })
                  team1Select.value = responseData.data.game.Team1_ID
                  team2Select.value = responseData.data.game.Team2_ID
                  if(responseData.data.game.scoreKeeperId !== null){
                    scoreKeeperSelect.value = responseData.data.game.scoreKeeperId
                  }
                  if(responseData.data.game.monitorId !== null){
                    monitorSelect.value = responseData.data.game.monitorId
                  }
                  if(responseData.data.game.referee1Id !== null){
                    ref1Select.value = responseData.data.game.referee1Id
                  }
                  if(responseData.data.game.referee2Id !== null){
                    ref2Select.value = responseData.data.game.referee2Id
                  }
                

                document.getElementById('gameInfoForm').style.display = ''
                document.getElementById('gameInfoForm').querySelector('[name="Event_ID"]').value = responseData.data.game.Event_ID
             }else{
                document.getElementById('gameInfoForm').style.display = 'none'
            }
            if(document.getElementById('formBackground').style.display == 'none'){
                document.getElementById('formBackground').style.display = ''
            }else{
                document.getElementById('formBackground').style.display = 'none'
            }
          } else {
            console.error('Form submission failed');
          }
    }catch(error){
        console.error('Error:', error);
    } 
}
async function updateGameData(xele){
    let xform = xele.form
    let formData = new FormData(xform)
    console.log(formData)
    // 1000000024 is teamId for TBD
    if((xform.querySelector('[name="Team1_ID"]').value == xform.querySelector('[name="Team2_ID"]').value) && xform.querySelector('[name="Team1_ID"]').value !== 1000000024){ 
      xform.querySelector('[name="Team1_ID"]').setCustomValidity('Team1 cannot match Team2')
        xform.querySelector('[name="Team1_ID"]').reportValidity()
        return
    }
    console.log([formData.get('scoreKeeper_ID'), formData.get('monitorId'), formData.get('ref1Id'), formData.get('ref2Id')])
    if(hasDuplicate([formData.get('scoreKeeper_ID'), formData.get('monitorId'), formData.get('ref1Id'), formData.get('ref2Id')])){
        xform.querySelector('[name="scoreKeeper_ID"]').setCustomValidity('Crew members cannot hold multiple roles in the same game.')
          xform.querySelector('[name="scoreKeeper_ID"]').reportValidity()
          return
      }
    xform.querySelector('[name="Team1_ID"]').setCustomValidity('')
    xform.querySelector('[name="scoreKeeper_ID"]').setCustomValidity('')
    const response = await fetch('/games/updateGameInfo', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        body: new URLSearchParams(formData).toString(),
        redirect: 'follow',
      });
      if (response.ok) {
        if (response.redirected) {
            window.location.href = response.url;
        }else{
            console.log(response);
            location.reload()
        }
        
      } else {
        console.error('Form submission failed');
      }
}
function toggleEventForm(ele){
    let xform = ele.form
    if(document.getElementById('eventForm').style.display == 'none'){
        document.getElementById('eventForm').style.display = ''
        document.getElementById('eventForm').querySelector('[name="playerId"]').value = xform.querySelector('[name="playerId"]').value
        document.getElementById('eventForm').querySelector('[name="teamName"]').value = xform.querySelector('[name="teamName"]').value
        document.getElementById('eventForm').querySelector('[name="Event_ID"]').value = xform.querySelector('[name="Event_ID"]').value
        document.getElementById('eventForm').getElementsByClassName('playerName')[0].innerHTML = xform.querySelector('[name="playerName"]').value
        document.getElementById('eventForm').getElementsByClassName('playerName')[0].parentElement.style.backgroundImage = ele.getElementsByClassName('playerItem')[0].style.backgroundImage
        document.getElementById('eventForm').querySelector('[name="opponentKeeper"]').value = xform.querySelector('[name="opponentKeeper"]').value
        document.getElementById('eventForm').querySelector('[name="keeper"]').value = xform.querySelector('[name="keeper"]').value
        document.getElementById('eventForm').querySelector('[name="season"]').value = xform.querySelector('[name="season"]').value
        document.getElementById('eventForm').querySelector('[name="subseason"]').value = xform.querySelector('[name="subseason"]').value
    }else{
        document.getElementById('eventForm').style.display = 'none'
    }
    if(document.getElementById('formBackground').style.display == 'none'){
        document.getElementById('formBackground').style.display = ''
    }else{
        document.getElementById('formBackground').style.display = 'none'
    }
}
function toggleForm(form,background){

    if(form.style.display == 'none'){
        form.style.display = ''
    }else{
        form.style.display = 'none'
    }
    if(background.style.display == 'none'){
        background.style.display = ''
    }else{
        background.style.display = 'none'
    }
}
async function exportStandings(xtype,xleague){
    let sqlString = `DECLARE @league varchar(255) Set @league = '${xleague}' Execute ${xtype}Standings @league`
    const response = await fetch('/standings/exportStandings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        body: new URLSearchParams({queryString: sqlString, fileName: `${xleague}_${xtype}_standings`, league: xleague, type: xtype}).toString(),
      });
      if (response.ok) {
        const blob = await response.blob();
        const filename = `${xtype}Standings${xleague}.csv`;
        if (window.navigator.msSaveOrOpenBlob) {
          // For IE and Edge
          window.navigator.msSaveBlob(blob, filename);
        } else {
          // For other browsers
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          document.body.appendChild(a);
          a.href = url;
          a.download = filename;
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      } else {
        console.error('CSV export failed');
      }
}
async function exportSchedule(xscheduleID){
    const response = await fetch('/schedules/exportSchedules', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        body: new URLSearchParams({scheduleId: xscheduleID}).toString(),
      });
      if (response.ok) {
        const blob = await response.blob();
        const filename = `Schedule_${xscheduleID}.csv`;
        if (window.navigator.msSaveOrOpenBlob) {
          // For IE and Edge
          window.navigator.msSaveBlob(blob, filename);
        } else {
          // For other browsers
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          document.body.appendChild(a);
          a.href = url;
          a.download = filename;
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
        }
      } else {
        console.error('CSV export failed');
      }
}
function touchMoveHandler(e,ele){
    let rect = ele.getBoundingClientRect()
if((rect.left>=e.clientX<=rect.right)&&(rect.top>=e.clientY<=rect.bottom)){
    ele.style.background = 'red'
}
}
function closeForm(){
    let forms = document.getElementsByClassName('popupForm')
    for(let form of forms){
        form.style.display = 'none'
    }
    document.getElementById('formBackground').style.display = 'none'
    if(document.getElementById('teamFormBackground')){
        document.getElementById('teamFormBackground').style.display = 'none'
    }
    
    closeFloating()
}
function closeFloating(){
    let eles = document.getElementsByClassName('floatingActionButtons block')
    if(eles.length > 0){
        for(let i =eles.length-1;i>-1;i--){
            eles[i].classList.replace('block', 'hidden')
        }
    }
    eles = document.getElementsByClassName('floating')
    if(eles.length > 0){
        for(let i=eles.length-1;i>-1;i--){
            eles[i].classList.remove('floating')
        }
    }
    eles = document.getElementsByClassName('floatingPopupForm')
    
    if(eles.length > 0){
        for(let i=eles.length-1;i>-1;i--){
            clearForm(eles[i])
            eles[i].style.display = 'none'
        }
    }
    eles = document.getElementsByClassName('popupBackground')
    
    if(eles.length > 0){
        for(let i=eles.length-1;i>-1;i--){
            eles[i].style.display = 'none'
        }
    }
    if(!document.getElementById('floatingBackground').classList.contains('hidden')){
        document.getElementById('floatingBackground').classList.add('hidden')
    }
}
function clearForm(form) {
    let inputs = form.getElementsByTagName('input');
    for (let input of inputs) {
        if (input.type !== 'hidden') {
            input.value = '';
        }
    }
}
function convertUnixTimeToMMDD(unixTime) {
    // Multiply by 1000 to convert seconds to milliseconds
    const date = new Date(unixTime);
  
    // Get month and day components
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
  
    // Concatenate month and day in "mm/dd" format
    const mmddFormat = `${month}/${day}`;
  
    return mmddFormat;
  }  
  async function switchSides(ele){
    let form = ele.form
    
    let formData = new FormData(form)
    try{
        const response = await fetch('/games/switchSides', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
            body: new URLSearchParams(formData).toString(),
          });
          if (response.ok) {
            const responseData = await response.json();
            location.reload()
          } else {
            console.error('Form submission failed');
          }
    }catch(error){
        console.error('Error:', error);
    }
  }
  function getOrdinalNumber(number) {
    // Convert the input to a number if it's a string
    const num = typeof number === 'string' ? parseInt(number, 10) : number;

    if (isNaN(num) || num < 0 || !Number.isInteger(num)) {
        return 'Invalid input';
    }

    if (num === 0) {
        return '0th';
    }

    const lastDigit = num % 10;
    const secondLastDigit = Math.floor((num % 100) / 10);

    if (secondLastDigit === 1) {
        return num + 'th';
    }

    switch (lastDigit) {
        case 1:
            return num + 'st';
        case 2:
            return num + 'nd';
        case 3:
            return num + 'rd';
        default:
            return num + 'th';
    }
}
function handleVisibilityChange() {

    if (document.visibilityState === 'visible' && window.location.pathname.indexOf('activeGame') !== -1) {
        // Page is visible, refresh the page
        window.location.reload(true);
    }
}

document.getElementById('newPlayerForm').querySelector('[name="email"]').addEventListener('blur',async function() {
    let formData = new FormData(document.getElementById('newPlayerForm'))
    const response = await fetch('/games/checkEmail', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams(formData).toString()
    })
    if (response.ok) {
        const responseData = await response.json();
        if(responseData.user){
            this.form.querySelector('[name="firstName"]').value = responseData.user.firstName
            this.form.querySelector('[name="lastName"]').value = responseData.user.lastName
            this.form.querySelector('[name="preferredName"]').value = responseData.user.preferredName
            this.form.querySelector('[name="waiver"]').checked = true
        }else{
            this.form.querySelector('[name="firstName"]').value = ''
            this.form.querySelector('[name="lastName"]').value = ''
            this.form.querySelector('[name="preferredName"]').value = ''
            this.form.querySelector('[name="waiver"]').checked = false
        }
      } else {
        console.error('Form submission failed');
      }
});
async function getTeams(xform){
    try {

        let formData = new FormData(xform)
        const response = await fetch(`/teams/getTeams`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams(formData).toString()
          });
        if (response.ok) {
            const results = await response.json();
            let team1
            let team2
            switch(xform.id){
                case 'newUserTeamForm':
                    team1 = xform.querySelector('[name="teamId"]');
                    team1.innerHTML = '<option value="" disabled selected>Team 1</option>';
                    results.teams.forEach(team => {
                        let option = document.createElement('option');
                        option.value = team.teamId;
                        option.text = team.abbreviation;
                        team1.appendChild(option);
                        
                    });
                    break
                case 'newGameForm':
                    team1 = xform.querySelector('[name="team1Id"]');
                    team2 = xform.querySelector('[name="team2Id"]');
                    team1.innerHTML = '<option value="" disabled selected>Team 1</option>';
                    team2.innerHTML = '<option value="" disabled selected>Team 2</option>';
                    let tbdOption1 = document.createElement('option')
                    tbdOption1.value = 1000000024
                    tbdOption1.text = 'TBD'
                    team1.appendChild(tbdOption1)

                    let tbdOption2 = document.createElement('option')
                    tbdOption2.value = 1000000024
                    tbdOption2.text = 'TBD'
                    team2.appendChild(tbdOption2)
                    
                    results.teams.forEach(team => {
                        let option1 = document.createElement('option');
                        option1.value = team.teamId;
                        option1.text = team.abbreviation;
                        team1.appendChild(option1);
                        
                        let option2 = document.createElement('option');
                        option2.value = team.teamId;
                        option2.text = team.abbreviation;
                        team2.appendChild(option2);
                        
                    });
                    break
                default:
                    break
            }
          } else {
            console.error('Form submission failed');
          }
    } catch (error) {
        console.error('Error fetching results:', error);
    }
}
async function getLeagues(xform){
    try {
        let formData = new FormData(xform)
        const response = await fetch(`/leagues/getLeagues`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams(formData).toString()
          });
        if (response.ok) {
            const results = await response.json();
            let league1 = xform.querySelector('[name="leagueId"]');
            league1.innerHTML = '<option value="" disabled selected>League</option>';
            results.leagues.forEach(league => {
                let option1 = document.createElement('option');
                option1.value = league.leagueId;
                option1.text = league.leagueName;
                league1.appendChild(option1);
            });
          } else {
            console.error('Form submission failed');
          }
    } catch (error) {
        console.error('Error fetching results:', error);
    }
}
async function paymentSubmit(form,event,path) {
            event.preventDefault();
            let formData = new FormData(form)
            console.log('check')
            const response = await fetch(`/api/payments/${path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: 
                new URLSearchParams(
                    formData
                ).toString(),
            })
        const { url } = await response.json();
        window.location.href = url; // Redirect to Stripe Checkout
}
function hasDuplicate(values) {
    console.log(values)
    console.log(values.length)
    const filteredValues = values.filter(val => val !== 'TBD'); // Remove 'TBD' values
    console.log(filteredValues)
    console.log(filteredValues.length)
    const uniqueValues = new Set(filteredValues);
    console.log(uniqueValues)
    console.log(uniqueValues.length)
    return uniqueValues.size < filteredValues.length; // Check for duplicates
}
// Event listener for visibility change
document.addEventListener('visibilitychange', handleVisibilityChange);