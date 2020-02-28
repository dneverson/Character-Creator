/*============================================================================
* @author Derry Everson
*============================================================================*/
var app = angular.module("ccApp", []);
app.controller("ccCtrl", function($scope, $http, dice){

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


  $scope.data = {
    ccView: {classes:1,races:0,backgrounds:0},
    char: {
      name:"",class:[{name:"",level:1}],race:{},background: {},alignment:"",
      exp:0,speed:0,personality:[],ideals:[],levelsMax:20,levelsCur:1,levelsRem:20,
      flaws:[],allies:[],backgroundStory:[],notes:[],feats:{},bonds:[],
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
      proficiencies: {armor:{},instruments:{},kits:{},languages:{},tools:{},vehicles:{},weapons:{}},
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


  /*=======================================================================*
  * Temp While a Generic Function is created for all deez
  *========================================================================*/
  //  Amount, Dice Type, Keep Amount, Reroll [ARRAY]
  $scope.roll = function(amnt,dt,kp,rr){$scope.data.char.rolledStats = dice.rollDicess(amnt,dt,kp,rr)};
  $scope.rollStats4d6k3 = function(){$scope.data.char.rolledStats = dice.rollStats4d6k3()};
  $scope.rollStats4d6k3r1 = function(){$scope.data.char.rolledStats = dice.rollStats4d6k3r1()};
  $scope.rollStats3d6 = function(){$scope.data.char.rolledStats = dice.rollStats3d6()};
  $scope.rollStats3d6r1 = function(){ $scope.data.char.rolledStats = dice.rollStats3d6r1()};
  $scope.arrayStats = function(){ $scope.data.char.rolledStats = dice.arrayStats()};
  $scope.pbStats = function(){ $scope.data.char.rolledStats = dice.pbStats() };
  $scope.rollStatsMatrix = function(){
    $scope.data.char.rolledMatrixStats = dice.rollStatsMatrix(6,6);
    dice.setBest($scope.data.char.rolledMatrixStats);
  };




  /*=======================================================================*
  * DOM FUNCTIONS MOVE TO SERVICE?
  *========================================================================*/
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


  function checkbooks(){

  };


  $scope.updateLevels = function(){
    try{
      var sum = 0;
      var obj = $scope.data.char;
      for (var i=0; i<obj.class.length; i++){
        sum += obj.class[i].level
      }
      obj.levelsCur = sum
      obj.levelsRem = ((obj.levelsMax)-(obj.levelsCur));
    }catch(e){
      console.log("error");
    }
  };

  $scope.addClass = function(){
    var obj = $scope.data.char;
    var maxLen = obj.levelsMax-obj.levelsCur;
    if(obj.levelsCur < obj.levelsMax){
      obj.class.push({name:"",level:1});
    }else window.alert("Maximum Level Reached ("+obj.levelsMax+")");
  };

  $scope.removeIndexClass = function(loc){
    $scope.data.char.class.splice(loc,1);
  };


  $scope.updateClasses = function(){
    console.log($scope.classOptions, $scope.classOptions2)
    $scope.classOptions = angular.copy($scope.classOptions2);
    for (clss in $scope.classOptions2) {
      for (var i=0; i<$scope.data.char.class.length; i++){
        if($scope.data.char.class[i].name.toUpperCase() == clss.toUpperCase()) delete $scope.classOptions[clss]
      }}
  };

  $scope.loadClass = function(path, level){
    $http.get('./data/class/'+path).then(function(response){
      var obj = $scope.data.char.class
      obj[obj.length-1] = response.data.class[0];
      obj[obj.length-1].level = level;

    });

  }

  /*=======================================================================*
  * Gets json file from external local file
  *========================================================================*/
  $scope.$watch('$viewContentLoaded', function(event){
    $http.get('./data/class/index.json').then(function(response){
      var data = response.data
      $scope.classOptions = angular.copy(data);
      $scope.classOptions2 = angular.copy(data);
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
