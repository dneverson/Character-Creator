/*============================================================================
* @author Derry Everson
*============================================================================*/
var app = angular.module("ccApp", []);
app.controller("ccCtrl", function($scope, $http){

  /*=========================================================================
  * Used for diffrent browser adjustments
  *========================================================================*/
  var isOpera = (!!window.opr && !!opr.addons) || !!window.opera || navigator.userAgent.indexOf(' OPR/') >= 0;
  var isFirefox = typeof InstallTrigger !== 'undefined';
  var isSafari = /constructor/i.test(window.HTMLElement) || (function (p) { return p.toString() === "[object SafariRemoteNotification]"; })(!window['safari'] || (typeof safari !== 'undefined' && safari.pushNotification));
  var isIE = /*@cc_on!@*/false || !!document.documentMode;
  var isEdge = !isIE && !!window.StyleMedia;
  var isChrome = !!window.chrome && (!!window.chrome.webstore || !!window.chrome.runtime);

  /*=======================================================================*
  * Global Varibles
  *========================================================================*/
  var races;
  var feats;
  var backgrounds;
  var classMenu;

  $scope.data = {
    ccView: {classes:1,races:0,backgrounds:0},
    char: {
      name: "",
      class: {},
      race: {},
      background: {},
      alignment:"",
      exp: 0,
      speed: 0,
      personality: [],
      ideals: [],
      bonds: [],
      flaws: [],
      allies: [],
      backgroundStory: [],
      notes: [],
      feats: {},
      selectedBooks: ["PHB","MM","DMG"],
      carryCapacity: {mod: "str", multVar:15, multEnc:5, sMod:0, val: 0, speed:-10},
      spells: {0:{}, 1:{}, 2:{}, 3:{}, 4:{}, 5:{}, 6:{}, 7:{}, 8:{}, 9:{}},
      health: {mod: "con", sMod:0, max:0, cur:0, tmp:0},
      hitDice: {dice: "d10", total:0},
      deathSaves: {success:0, fail:0},
      spellAbility: {ability:"WIS", dc:0, bonus:0},
      monies: {cp:0, sp:0, ep:0, gp:0, pp:0, val:0}, //total value
      armorClass: {mod: "dex", aMod:0, sMod:0, val: 0}, //armorMod and SpecialMod
      initiative: {mod: "dex", smod:0, val:0},
      passivePerception: {mod: "wis", sMod:0, val:0, adv:0},
      proficiencies: {
        armor:        {},
        instruments:  {},
        kits:         {},
        languages:    {},
        tools:        {},
        vehicles:     {},
        weapons:      {}},
      rolledStats: [],
      stats: {
        str: {name: "Strength",     mod:0, val:0},
        dex: {name: "Dexterity",    mod:0, val:0},
        con: {name: "Constitution", mod:0, val:0},
        wis: {name: "Wisdom",       mod:0, val:0},
        int: {name: "Intelligence", mod:0, val:0},
        cha: {name: "Charisma",     mod:0, val:0}},
      savingThrows: {
        str: {mod: "str", sMod:0, val:0, actv:0},
        dex: {mod: "dex", sMod:0, val:0, actv:0},
        con: {mod: "con", sMod:0, val:0, actv:0},
        wis: {mod: "wis", sMod:0, val:0, actv:0},
        int: {mod: "int", sMod:0, val:0, actv:0},
        cha: {mod: "cha", sMod:0, val:0, actv:0}},
      skills: {
        acrobatics:     {mod: "dex", sMod:0, val:0, actv:0, prov:0},
        animalHandling: {mod: "wis", sMod:0, val:0, actv:0, prov:0},
        arcana:         {mod: "int", sMod:0, val:0, actv:0, prov:0},
        athletics:      {mod: "str", sMod:0, val:0, actv:0, prov:0},
        deception:      {mod: "cha", sMod:0, val:0, actv:0, prov:0},
        history:        {mod: "int", sMod:0, val:0, actv:0, prov:0},
        insight:        {mod: "wis", sMod:0, val:0, actv:0, prov:0},
        intimidation:   {mod: "cha", sMod:0, val:0, actv:0, prov:0},
        investigation:  {mod: "int", sMod:0, val:0, actv:0, prov:0},
        medicine:       {mod: "wis", sMod:0, val:0, actv:0, prov:0},
        nature:         {mod: "int", sMod:0, val:0, actv:0, prov:0},
        perception:     {mod: "wis", sMod:0, val:0, actv:0, prov:0},
        performance:    {mod: "cha", sMod:0, val:0, actv:0, prov:0},
        persuasion:     {mod: "cha", sMod:0, val:0, actv:0, prov:0},
        religion:       {mod: "int", sMod:0, val:0, actv:0, prov:0},
        sleightOfHand:  {mod: "dex", sMod:0, val:0, actv:0, prov:0},
        stealth:        {mod: "dex", sMod:0, val:0, actv:0, prov:0},
        survival:       {mod: "wis", sMod:0, val:0, actv:0, prov:0}},
    },
  };

  function printSavingThrow(){
    var yes = $scope.data.char.savingThrows.str.mod
    //console.log($scope.data.char.stats[yes].mod)
  };

  function printSkill(){
    var yes = $scope.data.char.skills.arcana.mod
    //console.log($scope.data.char.stats[yes].mod)
  };

  function getRandomInt(min, max) {
      var byteArray = new Uint8Array(1);
      window.crypto.getRandomValues(byteArray);
      var range = max - min + 1;
      var max_range = 256;
      if (byteArray[0] >= Math.floor(max_range / range) * range)
          return getRandomInt(min, max);
      return min + (byteArray[0] % range);
  };

  function rollDice(amnt,typ){
    var arr = new Array(amnt).fill(1);
    return arr.map(x => getRandomInt(1,typ));
  };

  function rollKeep(arr,keep){
    arr.sort(function(a, b){return b-a});
    result = arr.splice(0,keep);
    return result;
  };

  function rollReroll(arr, diceType, reroll){
    var result = arr.map(function(x){
      if (x==reroll){
        return rollDice(1, diceType)[0];
      }
      return x
    })
    return result;
  };

  function getStatMod(stat){
    return (Math.floor(stat/2)-5);
  };

  function rollSum(arr){
    return arr.reduce((a, b) => a + b, 0)
  };

  function getStatTotalMod(arr){
    var ppl = [];
    arr.map(x => ppl.push(getStatMod(x[0])));
    return ppl.reduce((a, b) => a + b, 0)
  };

  $scope.rollStats4d6k3 = function(){
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
    $scope.data.char.rolledStats = result
  };

  $scope.rollStats4d6k3r1 = function(){
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
    $scope.data.char.rolledStats = result
  };

  $scope.rollStats3d6 = function(){
    const amnt = 3;
    const diceType = 6;
    var result = [];
    for (var i=0; i<6; i++){
      var diceRolls = rollDice(amnt,diceType);
      var diceSum = rollSum(diceRolls);
      var diceMod = getStatMod(diceSum);
      result.push([diceSum, diceMod]);
    }
    $scope.data.char.rolledStats = result
  };

  $scope.rollStats3d6r1 = function(){
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
    $scope.data.char.rolledStats = result
  };

  $scope.arrayStats = function(){
    var arr = [15, 14, 13, 12, 10, 8];
    var result = [];
    for (var i=0; i<arr.length; i++){
      var diceMod = getStatMod(arr[i]);
      result.push([arr[i], diceMod])
    }
    $scope.data.char.rolledStats = result
  };

  $scope.pbStats = function(){
    var arr = [8, 8, 8, 8, 8, 8];
    var result = [];
    for (var i=0; i<arr.length; i++){
      var diceMod = getStatMod(arr[i]);
      result.push([arr[i], diceMod])
    }
    $scope.data.char.rolledStats = result
  };


  //Took 784025 Rolls to get 17,3 - 16,3 - 18,4 - 17,3 - 18,4 - 18,4
  //Total sum of mods = 21
  // var yes = true;
  // count = 0
  // while (yes){
  //   var tmp = getStatTotalMod($scope.data.char.rolledStats);
  //   if (tmp<=20){
  //     count ++;
  //     $scope.rollStats();
  //     console.log(count)
  //   }else{
  //     yes = false;
  //   }
  // }
  // console.log("Took "+count+" Rolls")
  // console.log("Total sum of mods = "+ getStatTotalMod($scope.data.char.rolledStats))


  $scope.rollStatsMatrix = function(){
    const amnt = 3;
    const diceType = 6;
    var result = [];
    for (var i=0;i<6;i++){
      var col = [];
      for (var j=0; j<6; j++){
        var diceRolls = rollDice(amnt,diceType);
        var diceSum = rollSum(diceRolls);
        var diceMod = getStatMod(diceSum);
        col.push([diceSum, diceMod, i, j]);
      }
      result.push(col);
    }
    $scope.data.char.rolledMatrixStats = result;
    setBest();
  };

  function setBest(){
    var arrBest = findBest();
    var arr = $scope.data.char.rolledMatrixStats;
    for (var i=0; i<arrBest[0].length; i++){
      var y = arrBest[0][i][2];
      var x = arrBest[0][i][3];
      arr[y][x].push(1)
    }
  };

  function findBest(){
    var arr = $scope.data.char.rolledMatrixStats;
    var bestCol = [[],[0]];
    var bestRow = [[],[0]];
    var bestDia = [[],[0]];
    //Best Col
    for (var i=0; i<arr.length;i++){
      var value = arr[i].reduce((a, b) => a + b[0], 0);
      if(value>bestCol[1]) bestCol = [arr[i],[value]];
    }
    //Best Row
    for (var i=0; i<arr.length;i++){
      var value = arr.reduce((a, b) => a + b[i][0], 0);
      if(value>bestRow[1]) bestRow = [arr.map((x,c) => x[i]),[value]];
    }
    //Diag top left to bottom right
    var tmp1 = arr.reduce((a, b, c) => a + b[c][0], 0);
    if(tmp1>bestDia[1]) bestDia = [arr.map((x,i) => x[i]),[tmp1]];
    //Diag top right to bottom left
    var tmp2 = arr.slice(0).reverse().reduce((a, b, c) => a + b[c][0], 0);
    if(tmp2>bestDia[1]) bestDia = [arr.slice(0).reverse().map((x,i) => x[i]),[tmp2]];

    var result = (bestCol[1]>bestRow[1])&&(bestCol[1]>bestDia[1])?bestCol:bestRow[1]>bestDia[1]?bestRow:bestDia;
    return result;
  }

  $scope.checkboxSwitch = function(item){
    item.status = item.status?false:true;
  };
  $scope.checkboxSwitchInline = function(item){
    if(isIE) item.status = item.status?false:true;
  };

  $scope.checkboxTextUpdate = function(books){
    $scope.data.char.selectedBooks = []
    for (var i=0; i<books.length; i++){
      var source = books[i].source;
      var status = books[i].status;
      if (status) $scope.data.char.selectedBooks.push(source)
    }
  };

  function isChecked(){
    sb = $scope.data.char.selectedBooks;
    bk = $scope.books
    for (var i=0; i<sb.length; i++){
      for (var x=0; x<bk.length;x++){
        if(bk[x].source == sb[i]) bk[x].status = true;
    }}
  };

  /*=======================================================================*
  * Gets json file from external local file
  *========================================================================*/
  $scope.$watch('$viewContentLoaded', function(event){
    $http.get('./data/class/index.json').then(function(response){
      classMenu = response.data;
      //console.log(classMenu)
    }).then(function(result){
      //Do stuff
    });

    $http.get('./data/books.json').then(function(response){
      $scope.books = response.data.book;
    }).then(function(result){
      isChecked();
    });
  });

  /*=======================================================================*
  * INIT
  *========================================================================*/
  function init(){
    $scope.rollStats4d6k3();
    $scope.rollStatsMatrix();

  };
  init();

});
