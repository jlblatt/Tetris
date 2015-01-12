"use strict";

var _SETTINGS = {
  gridWidth: 10,
  gridHeight: 18,
  baseSpeed: 1,
  levelModifier: 12,
  startLevel: 0,
  startHigh: 0,
  musicType: 'a',
  fancyGraphics: true,
  keys: {
    moveLeft: 65,
    moveRight: 68,
    softDrop: 83,
    hardDrop: 40,
    rotateLeft: 37,
    rotateRight: 39,
    pause: 27
  }
}

var _SOUNDS;
var _SPRITES;
var _STAGE;

var _PAUSED = false;
var _LAST_TIME;
var _SPAWN_BLOCK = true;

var _GRID;
var _CURRENT_BLOCK;
var _NEXT_BLOCK;
var _CURRENT_SPEED = _SETTINGS.baseSpeed;
var _LEVEL = 0;
var _LINES = 0;
var _SCORE = 0;

var _KEYS = {};
var _HARDDROPLOCK = false;
var _SOFTDROPLOCK = false;
var _ROTATELOCK = false;

var _GAMESTARTED = false;
var _GAMEOVER = false;

var _PERF = [];



$(window).load(function(){

  _SOUNDS = loadSounds();

  _STAGE = new Kinetic.Stage({
    container: 'stage'
  });
  $(window).on("resize", resizeStage);
  resizeStage();

  initSettings();
});

function startGame()
{
  setupKeybinds();

  //cookie
  $.cookie('startHigh', parseInt($("#high-input").val()), {expires: 365, path: '/'});
  $.cookie('startLevel', parseInt($("#level-input").val()), {expires: 365, path: '/'});
  $.cookie('musicType', $(".music.active").attr("data-type"), {expires: 365, path: '/'});
  $.cookie('moveLeft', parseInt($("#move-left-input").attr('data-charcode')), {expires: 365, path: '/'});
  $.cookie('moveRight', parseInt($("#move-right-input").attr('data-charcode')), {expires: 365, path: '/'});
  $.cookie('softDrop', parseInt($("#soft-drop-input").attr('data-charcode')), {expires: 365, path: '/'});
  $.cookie('hardDrop', parseInt($("#hard-drop-input").attr('data-charcode')), {expires: 365, path: '/'});
  $.cookie('rotateLeft', parseInt($("#rotate-left-input").attr('data-charcode')), {expires: 365, path: '/'});
  $.cookie('rotateRight', parseInt($("#rotate-right-input").attr('data-charcode')), {expires: 365, path: '/'});
  $.cookie('pause', parseInt($("#pause-input").attr('data-charcode')), {expires: 365, path: '/'});

  _SETTINGS.startHigh = parseInt($("#high-input").val());
  _SETTINGS.startLevel = parseInt($("#level-input").val());

  _SETTINGS.baseSpeed = parseInt($("#base-speed-input").val() / 10);
  _SETTINGS.levelModifier = parseInt($("#level-modifier-input").val());
  _SETTINGS.gridWidth = parseInt($("#grid-width-input").val());
  _SETTINGS.gridHeight = parseInt($("#grid-height-input").val());
  _SETTINGS.fancyGraphics = !$("#fancy-graphics-input").val() == "";

  _SETTINGS.keys.moveLeft = parseInt($("#move-left-input").attr('data-charcode'));
  _SETTINGS.keys.moveRight = parseInt($("#move-right-input").attr('data-charcode'));
  _SETTINGS.keys.softDrop = parseInt($("#soft-drop-input").attr('data-charcode'));
  _SETTINGS.keys.hardDrop = parseInt($("#hard-drop-input").attr('data-charcode'));
  _SETTINGS.keys.rotateLeft = parseInt($("#rotate-left-input").attr('data-charcode'));
  _SETTINGS.keys.rotateRight = parseInt($("#rotate-right-input").attr('data-charcode'));
  _SETTINGS.keys.pause = parseInt($("#pause-input").attr('data-charcode'));

  _LEVEL = parseInt($("#level-input").val());
  $("#level .hud-value").text(_LEVEL);
  
  _CURRENT_SPEED = _SETTINGS.baseSpeed - (_SETTINGS.baseSpeed * (_LEVEL / _SETTINGS.levelModifier));

  _SETTINGS.musicType = $(".music.active").attr("data-type");
  if(_SETTINGS.musicType != "off")
  {
    playSound("type" + _SETTINGS.musicType);
  }

  _GRID = loadLevel();
  _STAGE.add(_GRID);

  spawnBlock();

  $("#settings, #shade").hide();

  resizeStage();
  animate();

  _GAMESTARTED = true;
}




//////////////////////////
// ANIMATION
//////////////////////////

function animate(t)
{
  requestAnimationFrame(animate);
  draw(t);
}

function draw(t)
{ 
  var dt = t - _LAST_TIME;
  _LAST_TIME = t;

  if(dt) _PERF.push(dt);
  if(_PERF.length > 100)
  {
    var sum = 0;
    for(var i = 0; i < _PERF.length; i++)
    {
      sum += _PERF[i];
    }
    var avg = sum / 100;
    console.log(avg);
    _PERF = [];
  }

  if(!dt || _PAUSED || !_CURRENT_BLOCK || _GAMEOVER) return;

  //hard drop
  if(_KEYS[_SETTINGS.keys.hardDrop] && !_HARDDROPLOCK)
  {
    _HARDDROPLOCK = true;
    hardDrop();
  }

  else if(!_CURRENT_BLOCK.movingVertically && !_HARDDROPLOCK)
  {
    //check to make sure we can drop another row
    if(!canMove('down'))
    {
      //no space
      placeBlock();
    }

    else
    {
      //ok to drop another row
      _CURRENT_BLOCK.gridy++;

      var tweenDuration = .05;
      var delayDuration = _CURRENT_SPEED * 1200;

      //soft drop if keydown
      if(_KEYS[_SETTINGS.keys.softDrop])
      {
        delayDuration = 0;
      }

      var futureBlock = _CURRENT_BLOCK;
      
      if(_SETTINGS.fancyGraphics)
      {
        var blockTween = new Kinetic.Tween({
          node: _CURRENT_BLOCK,
          y: _CURRENT_BLOCK.gridy,
          duration: tweenDuration,
          easing: Kinetic.Easings.EaseInOut,
          onFinish: function() {
            setTimeout(function(){ 
              futureBlock.movingVertically = false;
              futureBlock.verticalTween.destroy(); 
              futureBlock.verticalTween = null;
            }, delayDuration);

          }
        });

        _CURRENT_BLOCK.movingVertically = true;
        _CURRENT_BLOCK.verticalTween = blockTween;

        blockTween.play();
      }

      else
      {
        futureBlock.y(futureBlock.gridy);
        _CURRENT_BLOCK.movingVertically = true;

        setTimeout(function(){ 
          futureBlock.movingVertically = false;
        }, delayDuration + (tweenDuration * 1000));
      }
    }
  }

  if(_KEYS[_SETTINGS.keys.rotateLeft] && !_CURRENT_BLOCK.rotating && !_ROTATELOCK && !_HARDDROPLOCK) 
  {
    _ROTATELOCK = true;
    rotateBlock("left");
  }
  else if(_KEYS[_SETTINGS.keys.rotateRight] && !_CURRENT_BLOCK.rotating && !_ROTATELOCK && !_HARDDROPLOCK) 
  {
    _ROTATELOCK = true;
    rotateBlock("right");
  }

  else if(_KEYS[_SETTINGS.keys.moveLeft] && canMove('left') && !_CURRENT_BLOCK.movingHorizontally && !_HARDDROPLOCK) moveBlock("left");
  else if(_KEYS[_SETTINGS.keys.moveRight] && canMove('right') && !_CURRENT_BLOCK.movingHorizontally && !_HARDDROPLOCK) moveBlock("right");

  _STAGE.batchDraw();
}





//////////////////////////
// GAME
//////////////////////////

function spawnBlock()
{
  var spawnOffset = 2;

  if(_GRID.grid[Math.floor((_SETTINGS.gridWidth / 2) - spawnOffset)][0]) gameOver();

  var blockType;

  if(!_NEXT_BLOCK)
  {
    blockType = Math.floor(Math.random() * _BLOCKS.length);
    _NEXT_BLOCK = new Kinetic.Layer({x: Math.floor((_SETTINGS.gridWidth / 2) - spawnOffset)});
    _NEXT_BLOCK.shadow = new Kinetic.Layer({x: Math.floor((_SETTINGS.gridWidth / 2) - spawnOffset)});
    _NEXT_BLOCK.grid = _BLOCKS[blockType];
    _NEXT_BLOCK.blockType = blockType;
  }

  _CURRENT_BLOCK = _NEXT_BLOCK;
  _CURRENT_BLOCK.grid = _NEXT_BLOCK.grid;

  blockType = Math.floor(Math.random() * _BLOCKS.length);
  _NEXT_BLOCK = new Kinetic.Layer({x: Math.floor((_SETTINGS.gridWidth / 2) - spawnOffset)});
  _NEXT_BLOCK.shadow = new Kinetic.Layer({x: Math.floor((_SETTINGS.gridWidth / 2) - spawnOffset)});
  _NEXT_BLOCK.grid = _BLOCKS[blockType];
  _NEXT_BLOCK.blockType = blockType;

  $("#next .hud-value").empty().css({width: _NEXT_BLOCK.grid.length * 40, height: _NEXT_BLOCK.grid[0].length * 40});

  var nextBlockHeight = _NEXT_BLOCK.grid[0].length;
  var nextBlockWidth = _NEXT_BLOCK.grid.length;

  for(var j = 0; j < nextBlockHeight; j++)
  {
    for(var i = 0; i < nextBlockWidth; i++)
    {
      if(_NEXT_BLOCK.grid[i][j])
        $("#next .hud-value").append('<div class="block" style="background-color: rgb(' + _COLORS[_NEXT_BLOCK.blockType][0] + ',' + _COLORS[_NEXT_BLOCK.blockType][1] + ',' + _COLORS[_NEXT_BLOCK.blockType][2] + ');"></div>');
      
      else
        $("#next .hud-value").append('<div class="block"></div>');
    }
  }

  var currentBlockWidth = _CURRENT_BLOCK.grid.length;
  
  for(var i = 0; i < currentBlockWidth; i++)
  {
    var currentBlockHeight = _CURRENT_BLOCK.grid[i].length;

    for(var j = 0; j < currentBlockHeight; j++)
    {
      if(_CURRENT_BLOCK.grid[i][j])
      {
        _CURRENT_BLOCK.grid[i][j] = spawnSingleSquare(i, j, _CURRENT_BLOCK.blockType);
        _CURRENT_BLOCK.add(_CURRENT_BLOCK.grid[i][j]);
        if(_SETTINGS.fancyGraphics)
        {
          _CURRENT_BLOCK.add(_CURRENT_BLOCK.grid[i][j].innerone);
          _CURRENT_BLOCK.add(_CURRENT_BLOCK.grid[i][j].innertwo);
        }
        _CURRENT_BLOCK.shadow.add(_CURRENT_BLOCK.grid[i][j].shadow);
      }
    }
  }

  _CURRENT_BLOCK.gridx = Math.floor((_SETTINGS.gridWidth / 2) - spawnOffset);
  _CURRENT_BLOCK.gridy = 0;
  _CURRENT_BLOCK.movingVertically = true;
  _CURRENT_BLOCK.movingHorizontally = false;
  _CURRENT_BLOCK.horizontalTween = null;
  _CURRENT_BLOCK.verticalTween = null;
  _CURRENT_BLOCK.rotating = false;

  _CURRENT_BLOCK.shadow.x(_CURRENT_BLOCK.gridx);
  _CURRENT_BLOCK.shadow.y(calculateDestination());

  var futureBlock = _CURRENT_BLOCK;
  setTimeout(function(){ futureBlock.movingVertically = false; }, _CURRENT_SPEED * 1000);

  _STAGE.add(_CURRENT_BLOCK);
  _STAGE.add(_CURRENT_BLOCK.shadow);

  //draw next block
}

function spawnSingleSquare(i, j, blocktype)
{
  var color;
  if(typeof blocktype === 'undefined')
  { 
    color = _COLORS[Math.floor(Math.random() * _COLORS.length)];
  }
  else
  {
    color = _COLORS[blocktype];
  }

  var square = new Kinetic.Rect({
    x: i,
    y: j,
    fillRed: color[0],
    fillGreen: color[1],
    fillBlue: color[2],
    width: 1,
    height: 1
  });

  square.innerone = new Kinetic.Rect({
    x: i + .15,
    y: j + .15,
    fillRed: 0,
    fillGreen: 1, //0 doesn't work, gotta be a bug
    fillBlue: 0,
    fillAlpha: .10,
    width: .7,
    height: .7
  });

  square.innertwo = new Kinetic.Rect({
    x: i + .4,
    y: j + .4,
    fillRed: color[0],
    fillGreen: color[1],
    fillBlue: color[2],
    fillAlpha: .7,
    width: .2,
    height: .2
  });

  if(typeof blocktype !== 'undefined')
  {
    square.shadow = new Kinetic.Rect({
      x: i,
      y: j,
      fillRed: 255,
      fillGreen: 255,
      fillBlue: 255,
      fillAlpha: .05,
      width: 1,
      height: 1
    });
  }

  return square;
}

function canMove(dir)
{
  if(dir == "left")
  {
    if(_CURRENT_BLOCK.gridx == 0) return false;
    else 
    {
      var currentBlockWidth = _CURRENT_BLOCK.grid[0].length;
      for(var j = 0; j < currentBlockWidth; j++)
      {
        if(_CURRENT_BLOCK.grid[0][j] && _GRID.grid[_CURRENT_BLOCK.gridx - 1][_CURRENT_BLOCK.gridy + j]) return false;
      }
      return true;
    }

  }

  else if(dir == "right")
  {
    if(_CURRENT_BLOCK.gridx + _CURRENT_BLOCK.grid.length == _SETTINGS.gridWidth) return false;
    else 
    {
      var thisBlockWidth = _CURRENT_BLOCK.grid.length;
      var thisEnd = _CURRENT_BLOCK.grid[thisBlockWidth - 1].length;
      for(var j = 0; j < thisEnd; j++)
      {
        if(_CURRENT_BLOCK.grid[thisBlockWidth - 1][j] && _GRID.grid[_CURRENT_BLOCK.gridx + thisBlockWidth][_CURRENT_BLOCK.gridy + j]) return false;  
      }
      return true;
    }
  }

  else if (dir == "down")
  {
    if(_CURRENT_BLOCK.gridy + _CURRENT_BLOCK.grid[0].length == _SETTINGS.gridHeight) return false;
    else
    {
      var thisBlockWidth = _CURRENT_BLOCK.grid.length;
      for(var i = 0; i < thisBlockWidth; i++)
      {
        var thisBlockMaxHeight = _CURRENT_BLOCK.grid[i].length;
        var thisColumnHeight = 1;
        for(var j = 0; j < thisBlockMaxHeight; j++)
        {
          if(_CURRENT_BLOCK.grid[i][j]) thisColumnHeight = j + 1;
        }

        if(_GRID.grid[_CURRENT_BLOCK.gridx + i][_CURRENT_BLOCK.gridy + thisColumnHeight]) return false;
      }
      return true
    }
  }
}

function moveBlock(dir)
{
  var dx;
  if(dir == "left") dx = -1;
  else if(dir == "right") dx = 1;

  _CURRENT_BLOCK.gridx += dx;
  _CURRENT_BLOCK.movingHorizontally = true;

  var futureBlock = _CURRENT_BLOCK;

  if(_SETTINGS.fancyGraphics)
  {
    var blockTween = new Kinetic.Tween({
      node: _CURRENT_BLOCK,
      x: _CURRENT_BLOCK.gridx,
      duration: .06,
      easing: Kinetic.Easings.EaseInOut
    });

    _CURRENT_BLOCK.horizontalTween = blockTween;
    blockTween.play();

    setTimeout(function(){ 
      futureBlock.movingHorizontally = false; 
      futureBlock.horizontalTween.destroy(); 
      futureBlock.horizontalTween = null;
    }, 120);
  }

  else
  {
    _CURRENT_BLOCK.x(_CURRENT_BLOCK.gridx);
    setTimeout(function(){ 
      futureBlock.movingHorizontally = false;
    }, 120);
  }

  var shadowDest = calculateDestination();
  _CURRENT_BLOCK.shadow.x(_CURRENT_BLOCK.gridx);
  if(shadowDest > _CURRENT_BLOCK.gridy) _CURRENT_BLOCK.shadow.y(shadowDest);

  playSound("move");
 
}

function placeBlock()
{
  //place block, check for completed lines, and spawn a new block
  var blockWidth = _CURRENT_BLOCK.grid.length;
  for(var i = 0; i < blockWidth; i++)
  {
    var blockHeight = _CURRENT_BLOCK.grid[i].length;
    for(var j = 0; j < blockHeight; j++)
    {
      if(_CURRENT_BLOCK.grid[i][j])
      {
        _CURRENT_BLOCK.grid[i][j].x(_CURRENT_BLOCK.gridx + i);
        _CURRENT_BLOCK.grid[i][j].y(_CURRENT_BLOCK.gridy + j);
        if(_SETTINGS.fancyGraphics)
        {
          _CURRENT_BLOCK.grid[i][j].innerone.x(_CURRENT_BLOCK.gridx + i + .15);
          _CURRENT_BLOCK.grid[i][j].innerone.y(_CURRENT_BLOCK.gridy + j + .15);
          _CURRENT_BLOCK.grid[i][j].innertwo.x(_CURRENT_BLOCK.gridx + i + .4);
          _CURRENT_BLOCK.grid[i][j].innertwo.y(_CURRENT_BLOCK.gridy + j + .4);
        }

        _GRID.grid[_CURRENT_BLOCK.gridx + i][_CURRENT_BLOCK.gridy + j] = _CURRENT_BLOCK.grid[i][j];

        _GRID.add(_CURRENT_BLOCK.grid[i][j]);
        if(_SETTINGS.fancyGraphics)
        {
          _GRID.add(_CURRENT_BLOCK.grid[i][j].innerone);
          _GRID.add(_CURRENT_BLOCK.grid[i][j].innertwo);
        }
      }
    }
  }

  _CURRENT_BLOCK.shadow.destroy();
  _CURRENT_BLOCK.shadow = null;

  _CURRENT_BLOCK.destroy();
  _CURRENT_BLOCK = null;


  if(!completedLines())
  {
    playSound("drop");
    spawnBlock();
  }
}

function rotateBlock(dir)
{
  //transpose the grid
  var newGrid = new Array(_CURRENT_BLOCK.grid[0].length);

  var thisBlockWidth = _CURRENT_BLOCK.grid.length;
  for(var i = 0; i < thisBlockWidth; i++)
  {
    var thisBlockHeight = _CURRENT_BLOCK.grid[i].length;
    for(var j = 0; j < thisBlockHeight; j++)
    {
      if(!newGrid[j]) newGrid[j] = [];
      newGrid[j].push(_CURRENT_BLOCK.grid[i][j]);
    }
  }

  if(dir == "right")
  {
    //reverse each column
    newGrid.reverse();
  }

  else if (dir == "left")
  {
    //reverse each row
    for(var i = 0; i < newGrid.length; i++)
    {
      newGrid[i].reverse();
    }
  }

  //need to check if we have space to rotate here
  //horizontally

  var blockVertSize = newGrid[0].length;
  var blockHorizSize = newGrid.length;

  for(var j = 0; j < blockVertSize; j++)
  {
    var thisRowWidth = 0;
    for(var i = 0; i < blockHorizSize; i++)
    {
      if(newGrid[i][j]) thisRowWidth = i + 1;
    }

    var availableSpace = 0;
    for(var i = _CURRENT_BLOCK.gridx; i >= 0; i--)
    {
      if(_GRID.grid[i][_CURRENT_BLOCK.gridy + j]) break;
      else availableSpace++;
    }

    for(var i = _CURRENT_BLOCK.gridx + 1; i < _SETTINGS.gridWidth; i++)
    {
      if(_GRID.grid[i][_CURRENT_BLOCK.gridy + j]) break;
      else availableSpace++;
    }

    if(availableSpace < thisRowWidth) return;
  }

  //vertically
  if(_CURRENT_BLOCK.gridy >= calculateDestination()) return;


  //move blocks

  var newBlockWidth = newGrid.length;
  for(var i = 0; i < newBlockWidth; i++)
  {
    var newBlockHeight = newGrid[i].length;
    for(var j = 0; j < newBlockHeight; j++)
    {
      if(newGrid[i][j])
      {
        newGrid[i][j].x(i);
        newGrid[i][j].y(j);

        newGrid[i][j].shadow.x(i);
        newGrid[i][j].shadow.y(j);

        newGrid[i][j].innerone.x(i + .15);
        newGrid[i][j].innerone.y(j + .15);

        newGrid[i][j].innertwo.x(i + .4);
        newGrid[i][j].innertwo.y(j + .4);
      }
    }
  }

  _CURRENT_BLOCK.grid = newGrid;

  //fix horizontal position if collision
  if(_CURRENT_BLOCK.gridx + _CURRENT_BLOCK.grid.length > _SETTINGS.gridWidth)
  {
    if(_CURRENT_BLOCK.horizontalTween) _CURRENT_BLOCK.horizontalTween.finish();
    _CURRENT_BLOCK.gridx = _SETTINGS.gridWidth - _CURRENT_BLOCK.grid.length;
    _CURRENT_BLOCK.x(_SETTINGS.gridWidth - _CURRENT_BLOCK.grid.length);
  }

  var shadowDest = calculateDestination();
  _CURRENT_BLOCK.shadow.x(_CURRENT_BLOCK.gridx);
  if(shadowDest > _CURRENT_BLOCK.gridy) _CURRENT_BLOCK.shadow.y(shadowDest);

  _CURRENT_BLOCK.rotating = true;

  var futureBlock = _CURRENT_BLOCK;
  setTimeout(function(){ futureBlock.rotating = false; }, 120);

  playSound("rotate");
}

function completedLines()
{
  var lines = [];
  var lineIDs = [];

  for(var j = 0; j < _SETTINGS.gridHeight; j++)
  {
    var row = [];
    
    for(var i = 0; i < _SETTINGS.gridWidth; i++)
    {
      if(_GRID.grid[i][j]) row.push(_GRID.grid[i][j]);
    }

    if(row.length == _SETTINGS.gridWidth) 
    {
      for(var i = 0; i < _SETTINGS.gridWidth; i++)
      {
        _GRID.grid[i][j] = false;
      }

      lines.push(row);
      lineIDs.push(j);
    }
  }

  var numLines = lines.length;

  if(numLines == 0) return false;

  var basePoints = [40, 100, 300, 1200];
  _LINES += numLines;
  _SCORE += basePoints[numLines - 1] * (_LEVEL + 1);
  _LEVEL = Math.floor(_LINES / 10) + _SETTINGS.startLevel;

  _CURRENT_SPEED = _SETTINGS.baseSpeed - (_SETTINGS.baseSpeed * (_LEVEL / _SETTINGS.levelModifier));
  if(_CURRENT_SPEED < .02) _CURRENT_SPEED = .02;


  if(_SETTINGS.musicType != "off") 
  {
    var rate = 1 + ((_LEVEL - _SETTINGS.startLevel) * .05);
    if(rate > 3) rate = 3;
    _SOUNDS['type' + _SETTINGS.musicType][0].playbackRate = rate;
  }

  $("#score .hud-value").text(_SCORE);
  $("#level .hud-value").text(_LEVEL);
  $("#lines .hud-value").text(_LINES);

  for(var i = 0; i < numLines; i++)
  {
    var lineWidth = lines[i].length;
    for(var j = 0; j < lineWidth; j++)
    {
      setTimeout(destroyCell, (1200 * j) / _SETTINGS.gridWidth, lines[i][j]);

      for(var k = 0; k < _SETTINGS.gridWidth * 2; k++)
      {
        setTimeout(flashCell, (600 * k) / _SETTINGS.gridWidth, lines[i][j]);
      }
    }
  }

  setTimeout(function(){ dropGrid(lineIDs.reverse()); }, 1200);
  setTimeout(spawnBlock, 1400);

  //yay for tetris!
  if(numLines == 4)
  {
    playSound("tetris");
    strobe(9);
  }
  else
  {
    playSound("line");
  }

  return true;
}

function destroyCell(cell)
{
  cell.offset({x: .5, y: .5});
  cell.position({x: cell.getX() + .5, y: cell.getY() + .5});

  cell.innerone.destroy();

  cell.innertwo.offset({x: .1, y: .1});
  cell.innertwo.position({x: cell.innertwo.getX() + .1, y: cell.innertwo.getY() + .1});

  var block1Tween = new Kinetic.Tween({
    node: cell,
    rotation: 180,
    opacity: 0,
    scaleX: 0,
    scaleY: 0,
    duration: .2,
    easing: Kinetic.Easings.EaseInOut,
    onFinish: function() {
      cell.destroy();
    }
  });

  block1Tween.play();

  var block3Tween = new Kinetic.Tween({
    node: cell.innertwo,
    opacity: 0,
    scaleX: 10,
    scaleY: 10,
    duration: .3,
    easing: Kinetic.Easings.EaseInOut,
    onFinish: function() {
      cell.innertwo.destroy();
    }
  });

  block3Tween.play();
}

function flashCell(cell)
{
  if(!cell.fill() || cell.fill() == 'black') cell.fill('white');
  else cell.fill('black');
}

function dropGrid(lineIDs)
{
  var totalAmt = lineIDs.length;

  for(var i = 0; i < _SETTINGS.gridWidth; i++)
  {
    var tmpLineIDs = lineIDs.slice(0); //clone
    for(var j = _SETTINGS.gridHeight - 1; j > totalAmt - 1; j--)
    {
      if(tmpLineIDs.indexOf(j) >= 0)
      {
        _GRID.grid[i].splice(j, 1);
        _GRID.grid[i].unshift(false);
        tmpLineIDs.splice(tmpLineIDs.indexOf(j), 1);
        
        for(var k = 0; k < tmpLineIDs.length; k++)
        {
          tmpLineIDs[k]++;
        }

        j++;
      }
    }
  }

  var gridWidth = _GRID.grid.length;
  for(var i = 0; i < gridWidth; i++)
  {
    var gridHeight = _GRID.grid[i].length;
    for(var j = 0; j < gridHeight; j++)
    {
      if(_GRID.grid[i][j])
      {
        var blockTween = new Kinetic.Tween({
          node: _GRID.grid[i][j],
          y: j,
          duration: .2,
          easing: Kinetic.Easings.EaseInOut
        });

        blockTween.play();

        blockTween = new Kinetic.Tween({
          node: _GRID.grid[i][j].innerone,
          y: j + .15,
          duration: .2,
          easing: Kinetic.Easings.EaseInOut
        });

        blockTween.play();

        blockTween = new Kinetic.Tween({
          node: _GRID.grid[i][j].innertwo,
          y: j + .4,
          duration: .2,
          easing: Kinetic.Easings.EaseInOut
        });

        blockTween.play();
      }
    }
  }
}

function hardDrop()
{
  var destination = calculateDestination();

  if(destination < _CURRENT_BLOCK.gridy) return;

  var blockTween = new Kinetic.Tween({
    node: _CURRENT_BLOCK,
    y: destination,
    duration: .1,
    easing: Kinetic.Easings.EaseInOut
  });

  _CURRENT_BLOCK.gridy = destination;
  blockTween.play();

  placeBlock();
}

function calculateDestination()
{
  var destination = _SETTINGS.gridHeight - _CURRENT_BLOCK.grid[0].length;

  var currentBlockWidth = _CURRENT_BLOCK.grid.length;
  for(var i = 0; i < currentBlockWidth; i++)
  {
    var thisColumnHeight = 0;
    var currentBlockHeight = _CURRENT_BLOCK.grid[i].length;
    for(var j = 0; j < currentBlockHeight; j++)
    {
      if(_CURRENT_BLOCK.grid[i][j]) thisColumnHeight = j;
    }

    for(var j = 0; j < _SETTINGS.gridHeight; j++)
    {
      if(_GRID.grid[_CURRENT_BLOCK.gridx + i][j]) 
      {
        if(j - thisColumnHeight - 1 < destination) destination = j - thisColumnHeight - 1;
      }
    } 
  }

  return destination;
}

function strobe(count)
{
  $("body").toggleClass('strobe');
  if(count > 0)
  {
    count--;
    setTimeout(strobe, 60, count--);
  }
}

function gameOver()
{
  _GAMEOVER = true;

  if(_SETTINGS.musicType != "off") _SOUNDS['type' + _SETTINGS.musicType][0].pause();
  playSound("gameover");

  var counter = 0;
  var step =  900 / (_GRID.grid.length * _GRID.grid[0].length);

  var gridy = _GRID.grid[0].length - 1;
  var gridx = _GRID.grid.length;
  
  for(var j = gridy; j > -1; j--)
  {
    for(var i = 0; i < gridx; i++)
    {
      counter += step;
      (function(i,j) {
        setTimeout(function(){
          var square = spawnSingleSquare(i, j);
          _GRID.add(square);
          if(_SETTINGS.fancyGraphics)
          {
            _GRID.add(square.innerone);
            _GRID.add(square.innertwo);
          }
          _STAGE.batchDraw();
        }, counter);
      })(i,j);
    }
  }
  

  setTimeout(function(){
    showMessage("WASTED!"); 
  }, 1000);
  
}




//////////////////////////
// INPUT
//////////////////////////

function setupKeybinds()
{
  $(window).on("keydown", function(e) {
    var code = e.keyCode || e.which;
    _KEYS[code] = true;

    if(code == _SETTINGS.keys.softDrop && !_SOFTDROPLOCK)
    {
      if(_CURRENT_BLOCK.verticalTween) _CURRENT_BLOCK.verticalTween.finish();
      _CURRENT_BLOCK.movingVertically = false;
      _SOFTDROPLOCK = true;
    }
  }); 

  $(window).on("keyup", function(e) {
    var code = e.keyCode || e.which;
    _KEYS[code] = false;

    if(_GAMESTARTED && code == _SETTINGS.keys.pause) 
    {
      if(!_GAMEOVER)
      {
        if(_PAUSED)
        {
          hideMessage();
          if(_SETTINGS.musicType != "off") _SOUNDS['type' + _SETTINGS.musicType][0].play();
        }

        else 
        {
          showMessage("Paused!");
          if(_SETTINGS.musicType != "off") _SOUNDS['type' + _SETTINGS.musicType][0].pause();
        }

        _PAUSED = !_PAUSED;
      }
    }

    else if(code == _SETTINGS.keys.rotateLeft || code == _SETTINGS.keys.rotateRight)
    {
      _ROTATELOCK = false;
    }

    else if(code == _SETTINGS.keys.hardDrop)
    {
      _HARDDROPLOCK = false;
    }

    else if(code == _SETTINGS.keys.softDrop)
    {
      _SOFTDROPLOCK = false;
    }

  });
}





//////////////////////////
// SYSTEM / MAINTENANCE
//////////////////////////

function showMessage(txt)
{
  $("#shade-message").text(txt);
  $("#shade, #shade-message").show();
}

function hideMessage()
{
  $("#shade, #shade-message").hide();
}

function playSound(snd)
{
  _SOUNDS[snd][0].currentTime = 0;
  _SOUNDS[snd][0].play();
  
  //might not work
  //var tmpSnd = _SOUNDS[snd].shift();
  //_SOUNDS[snd].push(tmpSnd);
  _SOUNDS[snd].push(_SOUNDS[snd].shift());
}

function resizeStage()
{
  //fill all the vertical space first then scale/center based on available width
  var attemptedHeight = $(window).height();
  var attemptedWidth = attemptedHeight / (_SETTINGS.gridHeight / _SETTINGS.gridWidth);

  var height = attemptedHeight;
  var width = attemptedWidth;

  if(attemptedWidth > $(window).width())
  {
    var ratio = $(window).width() / attemptedWidth;
    height = attemptedHeight * ratio;
    width = attemptedWidth * ratio;
  }

  _STAGE.width(width);
  _STAGE.height(height);
  _STAGE.scaleX(width / _SETTINGS.gridWidth);
  _STAGE.scaleY(height / _SETTINGS.gridHeight);

  var top = ($(window).height() - height) / 2;
  var left = ($(window).width() - width) / 2;

  $("#stage").css({width: width, height: height, top: top, left: left});
  $("#hud").css({top: top, left: left + width});

}


//////////////////////////
// LOADING / SETUP 
//////////////////////////

function initSettings()
{
  //http://stackoverflow.com/a/23377822
  var keyboardMap = ["","","","CANCEL","","","HELP","","BACK_SPACE","TAB","","","CLEAR","ENTER","RETURN","","SHIFT","CONTROL","ALT","PAUSE","CAPS_LOCK","KANA","EISU","JUNJA","FINAL","HANJA","","ESCAPE","CONVERT","NONCONVERT","ACCEPT","MODECHANGE","SPACE","PAGE_UP","PAGE_DOWN","END","HOME","←","↑","→","↓","SELECT","PRINT","EXECUTE","PRINTSCREEN","INSERT","DELETE","","0","1","2","3","4","5","6","7","8","9",":",";","LESS_THAN","=","GREATER_THAN","QUESTION_MARK","AT","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","WIN","","CONTEXT_MENU","","SLEEP","NUMPAD0","NUMPAD1","NUMPAD2","NUMPAD3","NUMPAD4","NUMPAD5","NUMPAD6","NUMPAD7","NUMPAD8","NUMPAD9","MULTIPLY","ADD","SEPARATOR","SUBTRACT","DECIMAL","DIVIDE","F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12","F13","F14","F15","F16","F17","F18","F19","F20","F21","F22","F23","F24","","","","","","","","","NUM_LOCK","SCROLL_LOCK","WIN_OEM_FJ_JISHO","WIN_OEM_FJ_MASSHOU","WIN_OEM_FJ_TOUROKU","WIN_OEM_FJ_LOYA","WIN_OEM_FJ_ROYA","","","","","","","","","","CIRCUMFLEX","EXCLAMATION","DOUBLE_QUOTE","HASH","DOLLAR","PERCENT","AMPERSAND","UNDERSCORE","OPEN_PAREN","CLOSE_PAREN","ASTERISK","PLUS","PIPE","HYPHEN_MINUS","OPEN_CURLY_BRACKET","CLOSE_CURLY_BRACKET","TILDE","","","","","VOLUME_MUTE","VOLUME_DOWN","VOLUME_UP","","","","",",","",".","/","BACK_QUOTE","","","","","","","","","","","","","","","","","","","","","","","","","","","OPEN_BRACKET","BACK_SLASH","CLOSE_BRACKET","'","","META","ALTGR","","WIN_ICO_HELP","WIN_ICO_00","","WIN_ICO_CLEAR","","","WIN_OEM_RESET","WIN_OEM_JUMP","WIN_OEM_PA1","WIN_OEM_PA2","WIN_OEM_PA3","WIN_OEM_WSCTRL","WIN_OEM_CUSEL","WIN_OEM_ATTN","WIN_OEM_FINISH","WIN_OEM_COPY","WIN_OEM_AUTO","WIN_OEM_ENLW","WIN_OEM_BACKTAB","ATTN","CRSEL","EXSEL","EREOF","PLAY","ZOOM","","PA1","WIN_OEM_CLEAR",""];

  //setup stored values if they exist
  if($.cookie('startHigh')) $("#high-input").val($.cookie('startHigh'));
  if($.cookie('startLevel')) $("#level-input").val($.cookie('startLevel'));

  if($.cookie('musicType'))
  {
    $(".music").removeClass("active");
    $(".music[data-type='" + $.cookie('musicType') + "']").addClass("active");
  }

  if($.cookie('moveLeft'))
  {
    $(".control-type").removeClass("active");
    $(".control-type[data-type='custom']").addClass("active");
  }

  if($.cookie('moveLeft')) $("#move-left-input").attr('data-charcode', $.cookie('moveLeft')).val(keyboardMap[$.cookie('moveLeft')]);
  if($.cookie('moveRight')) $("#move-right-input").attr('data-charcode', $.cookie('moveRight')).val(keyboardMap[$.cookie('moveRight')]);
  if($.cookie('softDrop')) $("#soft-drop-input").attr('data-charcode', $.cookie('softDrop')).val(keyboardMap[$.cookie('softDrop')]);
  if($.cookie('hardDrop')) $("#hard-drop-input").attr('data-charcode', $.cookie('hardDrop')).val(keyboardMap[$.cookie('hardDrop')]);
  if($.cookie('rotateLeft')) $("#rotate-left-input").attr('data-charcode', $.cookie('rotateLeft')).val(keyboardMap[$.cookie('rotateLeft')]);
  if($.cookie('rotateRight')) $("#rotate-right-input").attr('data-charcode', $.cookie('rotateRight')).val(keyboardMap[$.cookie('rotateRight')]);
  if($.cookie('pause')) $("#pause-input").attr('data-charcode', $.cookie('pause')).val(keyboardMap[$.cookie('pause')]);

  $("input[type='text']").each(function(){
    $(this).attr('data-lastval', $(this).val());
  });

  $("input.integer.single").keydown(function(e){
    var code = e.keyCode || e.which;
    var intVal = parseInt(String.fromCharCode(code));
    if(!isNaN(intVal))
    {
      var max = parseInt($(this).attr('data-max'));

      if(!isNaN(max) && intVal > max)
      {
        intVal = max;
      }
      
      $(this)
        .attr('data-lastval',intVal)
        .val(intVal)
        .blur();
    }

    else $(this).val($(this).attr('data-lastval')).blur();
  });

  $("input.integer").change(function(e){
    var newVal = $(this).val().replace(/\D/g, '');
    if(newVal == '') $(this).val($(this).attr('data-lastval')).blur();
    else
    {
      $(this)
        .val(newVal)
        .attr('data-lastval',newVal)
        .blur();
    }
  });

  $("input.checkbox").click(function(){
    $(this).val($(this).val() == "" ? "✔" : "").blur();
  });

  $("#level-input").change(function()
  {
    if($(this).val() < 0) $(this).val(0);
    else if($(this).val() > 9) $(this).val(9);
  });

  $("#high-input").change(function()
  {
    if($(this).val() < 0) $(this).val(0);
    else if($(this).val() > 5) $(this).val(5);
  });

  $(".music").click(function(){
    $(".music").removeClass("active");
    $(this).addClass("active");
  });

  $("input.keyboard").keydown(function(e){
    var code = e.keyCode || e.which;
    $(this).val(keyboardMap[code]).attr('data-charcode', code).blur();
    $(".control-type").removeClass("active");
    $(".control-type[data-type='custom']").addClass("active");
  });

  $("#controls-toggle").click(function(){ 
    var $wrap = $("#controls-wrap");
    $wrap.slideToggle('fast'); 
  });

  $(".control-type").click(function(){
    $(".control-type").removeClass("active");
    $(this).addClass("active");

    if($(this).attr('data-type') == "pc")
    {
      $("#move-left-input").attr('data-charcode', '65').val('A');
      $("#move-right-input").attr('data-charcode', '68').val('D');
      $("#soft-drop-input").attr('data-charcode', '83').val('S');
      $("#hard-drop-input").attr('data-charcode', '40').val('↓');
      $("#rotate-left-input").attr('data-charcode', '37').val('←');
      $("#rotate-right-input").attr('data-charcode', '39').val('→');
      $("#pause-input").attr('data-charcode', '27').val('ESC');
    }

    else if($(this).attr('data-type') == "console")
    {
      $("#move-left-input").attr('data-charcode', '37').val('←');
      $("#move-right-input").attr('data-charcode', '39').val('→');
      $("#soft-drop-input").attr('data-charcode', '40').val('↓');
      $("#hard-drop-input").attr('data-charcode', '38').val('↑');
      $("#rotate-left-input").attr('data-charcode', '90').val('Z');
      $("#rotate-right-input").attr('data-charcode', '88').val('X');
      $("#pause-input").attr('data-charcode', '27').val('ESC');      
    }

    else if($(this).attr('data-type') == "special")
    {
      $("#move-left-input").attr('data-charcode', '37').val('←');
      $("#move-right-input").attr('data-charcode', '39').val('→');
      $("#soft-drop-input").attr('data-charcode', '40').val('↓');
      $("#hard-drop-input").attr('data-charcode', '68').val('D');
      $("#rotate-left-input").attr('data-charcode', '38').val('↑');
      $("#rotate-right-input").attr('data-charcode', '999').val('');
      $("#pause-input").attr('data-charcode', '32').val('SPC');      
    }
  });

  $("#debug-toggle").click(function(){ 
    var $wrap = $("#debug-wrap");
    $wrap.slideToggle('fast'); 
  });


  $("#start-game").click(startGame);

  $("#settings").fadeIn('fast');
}

function loadSounds()
{
  var sounds = {};

  $("#preload .audio audio").each(function() {
    if(sounds[$(this).attr("data-name")]) sounds[$(this).attr("data-name")].push($(this).get(0));
    else sounds[$(this).attr("data-name")] = [$(this).get(0)];
  });

  return sounds;
}

function loadLevel(lev)
{
  var layer = new Kinetic.Layer();
  
  layer.grid = [];
  
  for(var i = 0; i < _SETTINGS.gridWidth; i++)
  {
    if(layer.grid.length == i) 
    {
      layer.grid.push([]);
    }

    for(var j = 0; j < _SETTINGS.gridHeight; j++)
    {
      var highCutoff = Math.floor(_SETTINGS.gridHeight - (_SETTINGS.startHigh * (_SETTINGS.gridHeight / 8)));

      if(j > highCutoff && Math.random() < .5)
      {
        var square = spawnSingleSquare(i, j);
        layer.grid[i].push(square);
        layer.add(square);
        if(_SETTINGS.fancyGraphics)
        {
          layer.add(square.innerone);
          layer.add(square.innertwo);
        }
      }
      else layer.grid[i].push(false);
    }
  }

  return layer;
}

var _BLOCKS = [

  [[1],
   [1],
   [1],
   [1]],

  [[1,0],
   [1,1],
   [1,0]],

  [[1,0],
   [1,1],
   [0,1]],

  [[0,1],
   [1,1],
   [1,0]],

  [[1,1],
   [1,1]],

  [[1,1],
   [1,0],
   [1,0]],

  [[1,0],
   [1,0],
   [1,1]]

];

var _COLORS = shuffle([
  [255, 59, 48],
  [255, 149, 0],
  [255, 204, 0],
  [76, 217, 100],
  [52, 170, 220],
  [0, 122, 255],
  [88, 86, 214],
  [255, 45, 85],
  [142, 142, 147],
  [199, 199, 204]
]);




//http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
function shuffle(array) 
{
  var currentIndex = array.length
    , temporaryValue
    , randomIndex
    ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

//http://stackoverflow.com/questions/15170942/how-to-rotate-a-matrix-in-an-array-in-javascript
