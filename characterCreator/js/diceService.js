/*============================================================================
* @author Derry Everson
*============================================================================*/

app.service('dice', function() {
  /*=======================================================================*
  * Gets Random Range Via Crypto Vs. Math.Random(), Crypto is better
  *========================================================================*/
  function getRandomInt(min, max) {
      var byteArray = new Uint8Array(1);
      window.crypto.getRandomValues(byteArray);
      var range = max - min + 1;
      var max_range = 256;
      if (byteArray[0] >= Math.floor(max_range / range) * range)
          return getRandomInt(min, max);
      return min + (byteArray[0] % range);
  };

  /*=======================================================================*
  * Rolls any amount of dice and type of sided dice IE 10d6 rollDice(10,6)
  *========================================================================*/
  function rollDice(amnt,typ){
    var arr = new Array(amnt).fill(1);
    return arr.map(x => getRandomInt(1,typ));
  };

  /*=======================================================================*
  * Recives array, sorts, and keeps keep amount and drops the rest
  *========================================================================*/
  function rollKeep(arr,keep){
    arr.sort(function(a, b){return b-a});
    result = arr.splice(0,keep);
    return result;
  };

  /*=======================================================================*
  * Recieves array, Rerolls number given with dice type given
  *========================================================================*/
  function rollReroll(arr, diceType, reroll){
    var result = arr.map(function(x){
      if (x==reroll) return rollDice(1,diceType)[0];
      return x
    })
    return result;
  };

  /*=======================================================================*
  * Returns stat modifier of stat given
  *========================================================================*/
  function getStatMod(stat){
    return (Math.floor(stat/2)-5);
  };

  /*=======================================================================*
  * Returns sum of array
  *========================================================================*/
  function rollSum(arr){
    return arr.reduce((a, b) => a + b, 0)
  };

  /*=======================================================================*
  * Returns total summ of all rolls in array
  * NOT USED NOT USED NOT USED
  *========================================================================*/
  function getStatTotalMod(arr){
    var ppl = [];
    arr.map(x => ppl.push(getStatMod(x[0])));
    return ppl.reduce((a, b) => a + b, 0)
  };

  /*=======================================================================*
  * Finds Best sums in Matrix grid
  *========================================================================*/
  function findBest(arr){
    var bestCol = [[],[0]];
    var bestRow = [[],[0]];
    var bestDia = [[],[0]];
    //Best Col
    for (var i=0; i<arr.length;i++){
      var value = arr[i].reduce((a, b) => a + b[0], 0);
      if(value>bestCol[1]) bestCol = [arr[i],[value]];
      else if (value==bestCol[1]) bestCol.push(arr[i],[value]);
    }
    //Best Row
    for (var i=0; i<arr.length;i++){
      var value = arr.reduce((a, b) => a + b[i][0], 0);
      if(value>bestRow[1]) bestRow = [arr.map((x,c) => x[i]),[value]];
      else if (value==bestRow[1]) bestRow.push(arr.map((x,c) => x[i]),[value]);
    }
    //Diag top left to bottom right
    var tmp1 = arr.reduce((a, b, c) => a + b[c][0], 0);
    if(tmp1>bestDia[1]) bestDia = [arr.map((x,i) => x[i]),[tmp1]];
    else if (tmp1==bestDia[1]) bestDia.push(arr.map((x,i) => x[i]),[tmp1]);
    //Diag top right to bottom left
    var tmp2 = arr.slice(0).reverse().reduce((a, b, c) => a + b[c][0], 0);
    if(tmp2>bestDia[1]) bestDia = [arr.slice(0).reverse().map((x,i) => x[i]),[tmp2]];
    else if (tmp2==bestDia[1]) bestDia.push(arr.slice(0).reverse().map((x,i) => x[i]),[tmp2]);
    var x = bestCol[1][0];
    var y = bestRow[1][0];
    var z = bestDia[1][0];
    var best = bestCol;
    if (best[1]<y) best = bestRow;
    if (best[1]<z) best = bestDia;
    if (best[1]==x&&x==y&&x==z) best = bestCol.concat(bestRow).concat(bestDia);
    else if (best[1]==x&&x==y) best = bestCol.concat(bestRow);
    else if (best[1]==x&&x==z) best = bestCol.concat(bestDia);
    else if (best[1]==y&&y==z) best = bestCol.concat(bestDia);
    return best;
  };

  /*=======================================================================*
  * Point Buy Stats
  *========================================================================*/
  this.pbStats = function(){
    var arr = [8, 8, 8, 8, 8, 8];
    var result = [];
    for (var i=0; i<arr.length; i++){
      var diceMod = getStatMod(arr[i]);
      result.push([arr[i], diceMod])
    }
    return result
  };

  /*=======================================================================*
  * Standard Array Stats
  *========================================================================*/
  this.arrayStats = function(){
    var arr = [15, 14, 13, 12, 10, 8];
    var result = [];
    for (var i=0; i<arr.length; i++){
      var diceMod = getStatMod(arr[i]);
      result.push([arr[i], diceMod])
    }
    return result
  };

  /*=======================================================================*
  * Matrix Array Stats - Mikel Jensen's Idea
  *========================================================================*/
  this.rollStatsMatrix = function(x,y){
    const amnt = 3;
    const diceType = 6;
    var result = [];
    for (var i=0;i<x;i++){
      var col = [];
      for (var j=0; j<y; j++){
        var diceRolls = rollDice(amnt,diceType);
        var diceSum = rollSum(diceRolls);
        var diceMod = getStatMod(diceSum);
        col.push([diceSum, diceMod, i, j]);
      }
      result.push(col);
    }
    return result;
  };

  /*=======================================================================*
  * Compress All stat rolls into generic function
  *========================================================================*/
  this.rollStats3d6r1 = function(){
    const amnt = 3;
    const diceType = 6;
    var result = [];
    for (var i=0; i<6; i++){
      var diceRolls = rollDice(amnt,diceType);
      var diceReroll = rollReroll(diceRolls,6,1);
      var diceSum = rollSum(diceReroll);
      var diceMod = getStatMod(diceSum);
      result.push([diceSum, diceMod]);
    }
    return result;
  };
  this.rollStats3d6 = function(){
    const amnt = 3;
    const diceType = 6;
    var result = [];
    for (var i=0; i<6; i++){
      var diceRolls = rollDice(amnt,diceType);
      var diceSum = rollSum(diceRolls);
      var diceMod = getStatMod(diceSum);
      result.push([diceSum, diceMod]);
    }
    return result;
  };
  this.rollStats4d6k3 = function(){
    const amnt = 4;
    const diceType = 6;
    var result = [];
    for (var i=0; i<6; i++){
      var diceRolls = rollDice(amnt,diceType);
      var diceKeeps = rollKeep(diceRolls,3);
      var diceSum = rollSum(diceKeeps);
      var diceMod = getStatMod(diceSum);
      result.push([diceSum, diceMod]);
    }
    return result
  };
  this.rollStats4d6k3r1 = function(){
    const amnt = 4;
    const diceType = 6;
    var result = [];
    for (var i=0; i<6; i++){
      var diceRolls = rollDice(amnt,diceType);
      var diceReroll = rollReroll(diceRolls,6,1);
      var diceKeeps = rollKeep(diceReroll,3);
      var diceSum = rollSum(diceKeeps);
      var diceMod = getStatMod(diceSum);
      result.push([diceSum, diceMod]);
    }
    return result;
  };

  /*=======================================================================*
  * Generic dice rolls
  *========================================================================*/
  this.rollDicess = function(amount,diceType,keepAmount,rerolls){
    var result = [];
    var tmp = rollDice(amount,diceType);
    if(rerolls){
      for (var x=0; x<rerolls.length;x++){
        tmp = rollReroll(tmp,diceType,rerolls[x]);
    }}
    if(keepAmount) tmp = rollKeep(tmp,keepAmount);
    diceSum = rollSum(tmp);
    return [tmp,diceSum];
  };

  /*=======================================================================*
  * Sets [4] to 1 from Find Best function for color coding in AngularJS HTML5
  *========================================================================*/
  this.setBest = function(arr){
    var arrBest = findBest(arr);
    for (var i = 0; i < arrBest.length-1; i++) {
      if(i%2!==0) continue;
      for (var j=0; j<arrBest[i].length; j++){
        var y = arrBest[i][j][2];
        var x = arrBest[i][j][3];
        arr[y][x].push(1)
    }}
  };


});
