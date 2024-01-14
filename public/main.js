
var eventLog = [

]
function sendGameData(){
    
}
if(sessionStorage.gameInfo == 'undefined' || sessionStorage.gameInfo == '' || sessionStorage.gameInfo == null) {
    var gameInfo = {
        period: 1,
        time: '15:00',
        timerButtonState: 'Start',
        touchTime: Date.now()
    }
    // document.getElementById('gameTimer').innerHTML = gameInfo.time
    // document.getElementById('period').innerHTML = `Period ${gameInfo.period} of 3`
    // document.getElementById('timerButton').innerHTML = gameInfo.timerButtonState
}else {
    gameInfo = JSON.parse(sessionStorage.gameInfo)
    // document.getElementById('gameTimer').innerHTML = gameInfo.time
    // document.getElementById('period').innerHTML = `Period ${gameInfo.period} of 3`
    // document.getElementById('timerButton').innerHTML = gameInfo.timerButtonState
}

window.addEventListener('beforeunload', (event) => {
    // gameInfo.time = document.getElementById('gameTimer').innerHTML
    // gameInfo.timerButtonState = document.getElementById('timerButton').innerHTML
    sessionStorage.setItem('gameInfo',JSON.stringify(gameInfo))
  });
class Game {
    constructor(){
        this.id = ''
        this.homeTeam = ''
        this.awayTeam = ''
        this.period = 1
        this.clockTime = ''
        this.log = []
    }
}
class Team {
    constructor(){
        this.id = ''
        this.name = ''
        this.keeper = ''
        this.players = []
        this.log = []
    }
}
class Player {
    constructor(){
        this.id = ''
        this.firstName = ''
        this.lastName = ''
        this.gender = ''
        this.log = []
    }
}
class GameEvent {
    constructor(){
        this.timeStamp = new Date(Date()).toISOString()
        this.period = GameInfo.period
        this.gameId = ''
        this.teamId = ''
        this.playerId = ''
        this.type = ''
        this.value = 0
        this.clockTime = ''
    }
}


document.addEventListener('DOMContentLoaded', function () {
    const eles = document.getElementsByClassName('fielderColumn')
    
    for(var i=0;i<eles.length;i++){
        const ele = eles[i]
        setDragScroll(ele)
    }
});

// document.addEventListener('visibilitychange', async () => {
//     if (screenLock !== null && document.visibilityState === 'visible') {
//       screenLock = await navigator.wakeLock.request('screen');
//     }
//   });
// document.addEventListener('touchstart', function () {
//     gameInfo.touchTime = Date.now()
// })
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
// var distance = Number(gameInfo.time.split(':')[0]) * 60 * 1000 + Number(gameInfo.time.split(':')[1]) * 1000;
var distance = Number(document.getElementById('timerForm').querySelector('[name="timerTime"]').value)
var x = setInterval(function() {
    ;
    
    if(document.getElementById('timerButton').innerText == 'Stop'){
        distance = distance - 1000;

        if (distance < 0) {
            
            // if(navigator.platform !== 'IPhone'){
            //     navigator.vibrate([200, 200])
            // }
            // // setTimeout(function(){document.getElementById("myAudio").play()}, 950)
            // document.getElementById("myAudio").muted = false
            // document.getElementById("myAudio").play()
            clearInterval(x);
            location.reload()
            
        } else{
            var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
            var seconds = Math.floor((distance % (1000 * 60)) / 1000).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
            document.getElementById("gameTimer").innerHTML = minutes + ":" + seconds;
        }
    }
  }, 1000);

  function timerStartStop(ele){
    switch(true){
        case ele.innerText.includes('Start') :
            // // document.getElementById("myAudio").play()
            // document.getElementById("myAudio").play().then(() => { // pause directly
            //     audio.pause();
            //     audio.currentTime = 0;
            //   });
            ele.form.querySelector('[name="timerState"]').value= 1
            ele.innerText = 'Stop'
            break
        case ele.innerText.includes('Stop'):
            ele.form.querySelector('[name="timerState"]').value= 0
            ele.innerText = 'Start'
            break
    }
    
  }


  function statHandler(ele,xperiod,val = 1){
    console.log('testonclick')
    var form = ele.form
    var statType = ele.value
    
        form.querySelector('[name="realTime"]').value = Date.now()
        // console.log(form.querySelector('[name="realTime"]').value)
        form.querySelector('[name="value"]').value = val
        // if(statType.includes('minus')){
        //     form.querySelector('[name="value"]').value = '-1'
        // }else {
        //     form.querySelector('[name="value"]').value = '1'
        // }
        form.querySelector('[name="period"]').value = xperiod
        form.querySelector('[name="periodTime"]').value = document.getElementById('gameTimer').innerText
        switch(statType){
            case 'goal':
                // document.getElementById(form.querySelector('[name="teamName"]').value + 'Score').innerText = Number(document.getElementById(form.querySelector('[name="teamName"]').value + 'Score').innerText) + 1
                break
        }
  }
  // mouseup need to be monitored on a "global" element or we might miss it if
// we move outside the original element.
var isDown = false,
isLong = false,
target,                                         // which element was clicked
longTID;
function handleMouseDown(ele, e) {
    console.log('mouse down')
//   this.innerHTML = "Mouse down...";
  isDown = true;                                    // button status (any button here)
  isLong = false;                                   // longpress status reset
  target = this;                                    // store this as target element
//   clearTimeout(longTID);                            // clear any running timers
  longTID = setTimeout(longPress, 500, ele, e); // create a new timer for this click
  return
};

function handleMouseUp(e) {
    // console.log(ele1.form)
  if (isDown && isLong) {                           // if a long press, cancel
    isDown = false;                                 // clear in any case
    e.preventDefault();                             // and ignore this event
    return
  }
  
  if (isDown) {                                     // if we came from down status:
      clearTimeout(longTID);                        // clear timer to avoid false longpress
      isDown = false;
      console.log('Normal up')
    //   target.innerHTML = "Normal up";               // for clicked element
      target = null;
  }
};

function longPress(ele,e) {
    var eles = ele.parentElement.getElementsByClassName('floatingActionButtons')
    ele.parentElement.classList.add('floating')
    eles[0].classList.replace('hidden','block')
    eles[1].classList.replace('hidden','block')
    // ele.attributes.removeNamedItem('ontouchstart')
    document.getElementById('floatingBackground').classList.remove('hidden')
  isLong = true;
  console.log('Long Press')
//   e.preventDefault()
  return
//   this.innerHTML = "Long press";
  // throw custom event or call code for long press
}
function handleLongPress(e){
    if(isLong){
        // e.preventDefault()
        return false
    }
}

function toggleAddPlayer(xform){
    if(document.getElementById('newPlayerForm').style.display == 'none'){
        var color = xform.querySelector('[name="color"]').value
        document.getElementById('newPlayerForm').style.display = ''
        document.getElementById('newPlayerForm').querySelector('[name="team"]').value = xform.querySelector('[name="team"]').value
        document.getElementById('newPlayerForm').style.backgroundImage = `linear-gradient(135deg, ${color}  ${color =='White' ? '40%, #ddd 50%, ' + color + ' 60%'  : '.5%, White 50%, ' + color + ' 99.5%'})`
    }else{
        document.getElementById('newPlayerForm').style.display = 'none'
    }
    if(document.getElementById('formBackground').style.display == 'none'){
        document.getElementById('formBackground').style.display = ''
    }else{
        document.getElementById('formBackground').style.display = 'none'
    }
}

function toggleEventForm(ele){
    var xform = ele.form
    if(document.getElementById('eventForm').style.display == 'none'){
        document.getElementById('eventForm').style.display = ''
        document.getElementById('eventForm').querySelector('[name="playerId"]').value = xform.querySelector('[name="playerId"]').value
        document.getElementById('eventForm').querySelector('[name="teamName"]').value = xform.querySelector('[name="teamName"]').value
        document.getElementById('eventForm').querySelector('[name="Event_ID"]').value = xform.querySelector('[name="Event_ID"]').value
        document.getElementById('eventForm').getElementsByClassName('playerName')[0].innerHTML = xform.querySelector('[name="playerName"]').value
        document.getElementById('eventForm').getElementsByClassName('playerName')[0].parentElement.style.backgroundImage = ele.getElementsByClassName('itemFormat secondaryStyle')[0].style.backgroundImage
        document.getElementById('eventForm').querySelector('[name="opponentKeeper"]').value = xform.querySelector('[name="opponentKeeper"]').value
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
function touchMoveHandler(e,ele){
    var rect = ele.getBoundingClientRect()
if((rect.left>=e.clientX<=rect.right)&&(rect.top>=e.clientY<=rect.bottom)){
    ele.style.background = 'red'
}
}
function closeForm(){
    var forms = document.getElementsByClassName('popupForm')
    for(i=0;i<forms.length;i++){
        forms[i].style.display = 'none'
    }
    document.getElementById('formBackground').style.display = 'none'
    closeFloating()
}
function closeFloating(){
    var eles = document.getElementsByClassName('floatingActionButtons block')
    
    if(eles.length > 0){
        for(i=eles.length-1;i>-1;i--){
            // console.log(eles)
            eles[i].classList.replace('block', 'hidden')
        }
    }
    var eles = document.getElementsByClassName('floating')
    
    if(eles.length > 0){
        for(i=eles.length-1;i>-1;i--){
            // console.log(eles)
            eles[i].classList.remove('floating')
        }
    }
    if(!document.getElementById('floatingBackground').classList.contains('hidden')){
        document.getElementById('floatingBackground').classList.add('hidden')
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