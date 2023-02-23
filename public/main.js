document.addEventListener('DOMContentLoaded', function () {
    const eles = document.getElementsByClassName('fielderColumn')
    for(var i=0;i<eles.length;i++){
        const ele = eles[i]
        setDragScroll(ele)
    }
});

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
        document.addEventListener('mouseup', mouseUpHandler);
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
        document.removeEventListener('mouseup', mouseUpHandler);
    };

    // Attach the handler
    ele.addEventListener('mousedown', mouseDownHandler);
}
var distance = 15 * 60 * 1000;
var x = setInterval(function() {

    // Get today's date and time
    // var now = new Date().getTime();
      
    // Find the distance between now and the count down date
    if(document.getElementById('timerButton').innerText == 'Stop'){
        distance = distance - 1000;
        
        // Time calculations for days, hours, minutes and seconds
        var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
        var seconds = Math.floor((distance % (1000 * 60)) / 1000).toLocaleString('en-US', {minimumIntegerDigits: 2, useGrouping:false});
        
        // Output the result in an element with id="demo"
        document.getElementById("gameTimer").innerHTML = minutes + ":" + seconds;
        
        // If the count down is over, write some text 
        if (distance < 0) {
        clearInterval(x);
        document.getElementById("gameTimer").innerHTML = "00:00";
        document.getElementById('timerButton').innerText = 'Start Period 2'
        }
    }
  }, 1000);

  function timerStartStop(ele){
    switch(true){
        case ele.innerText.includes('Start') :
            ele.innerText = 'Stop'
            break
        case ele.innerText.includes('Stop'):
            ele.innerText = 'Start'
            break
    }
    
  }


  function statHandler(statType, team){
    switch(statType){
        case 'goal':
            console.log(team + 'Score')
            document.getElementById(team + 'Score').innerText = Number(document.getElementById(team + 'Score').innerText) + 1
            break
    }
  }