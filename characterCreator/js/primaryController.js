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
  * Globals
  *========================================================================*/
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
        str: {name: "Strength",     sVal:0, rVal:0, oVal:0},
        dex: {name: "Dexterity",    sVal:0, rVal:0, oVal:0},
        con: {name: "Constitution", sVal:0, rVal:0, oVal:0},
        wis: {name: "Wisdom",       sVal:0, rVal:0, oVal:0},
        int: {name: "Intelligence", sVal:0, rVal:0, oVal:0},
        cha: {name: "Charisma",     sVal:0, rVal:0, oVal:0}},
      savingThrows: {
        str: {mod: "str", sMod:0, val:0, actv:0},
        dex: {mod: "dex", sMod:0, val:0, actv:0},
        con: {mod: "con", sMod:0, val:0, actv:0},
        wis: {mod: "wis", sMod:0, val:0, actv:0},
        int: {mod: "int", sMod:0, val:0, actv:0},
        cha: {mod: "cha", sMod:0, val:0, actv:0}},
      skills: {
        acrobatics:     {mod: "dex", sMod:0, val:0, actv:0, prov:0, lock:0},
        "animal handling": {mod: "wis", sMod:0, val:0, actv:0, prov:0, lock:0},
        arcana:         {mod: "int", sMod:0, val:0, actv:0, prov:0, lock:0},
        athletics:      {mod: "str", sMod:0, val:0, actv:0, prov:0, lock:0},
        deception:      {mod: "cha", sMod:0, val:0, actv:0, prov:0, lock:0},
        history:        {mod: "int", sMod:0, val:0, actv:0, prov:0, lock:0},
        insight:        {mod: "wis", sMod:0, val:0, actv:0, prov:0, lock:0},
        intimidation:   {mod: "cha", sMod:0, val:0, actv:0, prov:0, lock:0},
        investigation:  {mod: "int", sMod:0, val:0, actv:0, prov:0, lock:0},
        medicine:       {mod: "wis", sMod:0, val:0, actv:0, prov:0, lock:0},
        nature:         {mod: "int", sMod:0, val:0, actv:0, prov:0, lock:0},
        perception:     {mod: "wis", sMod:0, val:0, actv:0, prov:0, lock:0},
        performance:    {mod: "cha", sMod:0, val:0, actv:0, prov:0, lock:0},
        persuasion:     {mod: "cha", sMod:0, val:0, actv:0, prov:0, lock:0},
        religion:       {mod: "int", sMod:0, val:0, actv:0, prov:0, lock:0},
        "sleight of hand":  {mod: "dex", sMod:0, val:0, actv:0, prov:0, lock:0},
        stealth:        {mod: "dex", sMod:0, val:0, actv:0, prov:0, lock:0},
        survival:       {mod: "wis", sMod:0, val:0, actv:0, prov:0, lock:0}},
    },
  };

  /*=======================================================================*
  * Book Checkbox Sync for Book menu
  *========================================================================*/
  function isChecked(){
    sb = $scope.data.char.selectedBooks;
    bk = $scope.books
    for (var i=0; i<sb.length; i++){
      for (var x=0; x<bk.length;x++){
        if(bk[x].source == sb[i]) bk[x].status = true;
    }}
  };

  /*=======================================================================*
  * Resets Attributes to 0 when re-rolling stats  MINUS Racial Attributes
  *========================================================================*/
  $scope.resetStats = function(){
    $scope.rolledStats = angular.copy($scope.data.char.rolledStats);
    var obj = $scope.data.char.stats;
    for (stat in obj) obj[stat].sVal = obj[stat].oVal = 0;
  };

  /*=======================================================================*
  * Temp While a Generic Function is created for all deez
  *========================================================================*/
  //  Amount, Dice Type, Keep Amount, Reroll [ARRAY]
  $scope.roll = function(amnt,dt,kp,rr){$scope.data.char.rolledStats = dice.rollDicess(amnt,dt,kp,rr)};
  $scope.rollStats4d6k3 = function(){$scope.data.char.rolledStats = dice.rollStats4d6k3(); $scope.resetStats();};
  $scope.rollStats4d6k3r1 = function(){$scope.data.char.rolledStats = dice.rollStats4d6k3r1(); $scope.resetStats();};
  $scope.rollStats3d6 = function(){$scope.data.char.rolledStats = dice.rollStats3d6(); $scope.resetStats();};
  $scope.rollStats3d6r1 = function(){ $scope.data.char.rolledStats = dice.rollStats3d6r1(); $scope.resetStats();};
  $scope.arrayStats = function(){ $scope.data.char.rolledStats = dice.arrayStats(); $scope.resetStats();};
  $scope.pbStats = function(){ $scope.data.char.rolledStats = dice.pbStats(); $scope.resetStats();};
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
  //BETTER WAY TO DO THIS ASK MIKEL
  $scope.checkboxSwitchInline = function(item){
    if(isIE) item.status = item.status?false:true;
  };
  $scope.checkboxTextUpdate = function(books){
    var obj = $scope.data.char.selectedBooks = []
    for (var i=0; i<books.length; i++){
      if (books[i].status) obj.push(books[i].source);
  }};

  /*=======================================================================*
  * Adds a blank class to the class / multi-class container and data JSON
  *========================================================================*/
  $scope.addClass = function(){
    var obj = $scope.data.char;
    var maxLen = obj.levelsMax-obj.levelsCur;
    if(obj.levelsCur < obj.levelsMax){
      obj.class.push({name:"",level:1});
      // MAKE BETTER ALERT NOT STUPID WINDOW
    }else window.alert("Maximum Level Reached ("+obj.levelsMax+")");
  };

  /*=======================================================================*
  * Removes selected class from class menu list
  *========================================================================*/
  $scope.removeIndexClass = function(loc){
    $scope.data.char.class.splice(loc,1);
  };

  /*=======================================================================*
  * Sets / gets rolled dice menu list depenidng on what has been selected
  *========================================================================*/
  $scope.updateRollSelection = function(num){
    for (var i=0; i<$scope.rolledStats.length; i++){
      if($scope.rolledStats[i] == num){
        $scope.rolledStats.splice(i,1);
        break;
  }}};

  /*=======================================================================*
  * Sets / gets class menu list depenidng on what has been selected
  *========================================================================*/
  $scope.updateClasses = function(){
    $scope.classOptions = angular.copy($scope.classOptions2);
    for (clss in $scope.classOptions2) {
      for (var i=0; i<$scope.data.char.class.length; i++){
        if($scope.data.char.class[i].name.toUpperCase() == clss.toUpperCase()) delete $scope.classOptions[clss]
  }}
  // TEMP WHILE DOING CLASS FEATURES
  console.log($scope.data.char.class)
  };

  /*=======================================================================*
  * Sets levels remaining for max value in the class selection
  *========================================================================*/
  $scope.updateLevels = function(){
      var sum = 0;
      var obj = $scope.data.char;
      for (var i=0; i<obj.class.length; i++){
        sum += obj.class[i].level
      }
      obj.levelsCur = sum
      obj.levelsRem = ((obj.levelsMax)-(obj.levelsCur));
    };

  /*=======================================================================*
  * Sets / Resets racial abilities
  *========================================================================*/
  $scope.updateRStats = function(){
    var obj = $scope.data.char;
    for (skey in obj.stats){
      obj.stats[skey].rVal = 0;
      for (rkey in obj.race.ability[0]){
        if(skey == rkey) obj.stats[skey].rVal = obj.race.ability[0][rkey]
  }}};

  /*=======================================================================*
  * Calculates Mod value of stat provided
  *========================================================================*/
  $scope.updateMod = function(stat){
    return (Math.floor((stat)/2)-5);
  };

  /*=======================================================================*
  * Sets Character Class via JSON file
  *========================================================================*/
  $scope.loadClass = function(path, level, index){
    $http.get('./data/class/'+path).then(function(response){
      var obj = $scope.data.char.class
      obj[index] = response.data.class[0];
      obj[index].level = level;
    });
  };

  /*=======================================================================*
  * Checks if Race Speed is a number to diff from array
  *========================================================================*/
  $scope.isNumber = angular.isNumber;

  $scope.printss = function(feature){
    console.log(feature);
  };
  $scope.toggle = function(obj){
    obj = obj?0:1;
    return obj
  };

  $scope.skillToggle = function(skill, choice){
    if(!skill.lock){
      if(choice.count && !skill.prov){
        skill.prov = true;
        choice.count--;
      }
      else if(skill.prov){
        skill.prov = false;
        choice.count++;
      }
    }

  };

  $scope.getBackgroundSkillCount = function(background){
   try {
     var obj = background.skillProficiencies[0].choose;
     if(obj && !obj.count) obj.count = 1;
   }catch(e){}
  };

  $scope.resetSkills = function(){
    var obj = $scope.data.char.skills;
    for (var skill in obj){
      obj[skill].prov = obj[skill].lock = 0
    }
  };

  $scope.makeArr = function(obj){
    var result = [];
    angular.forEach(obj, function (val, key) {
        result.push({key: val, val: key});
    });
    return result;
  }

  $scope.parseString = function(text) {
    try {
      if(text.type == "dice") return (text.toRoll[0].number+"d"+text.toRoll[0].faces)
      else if(text.type == "bonusSpeed" ) return ("+"+text.value+"ft")
      else if(text.type == "bonus" ) return ("+"+text.value)
    } catch (e) {}
    try {
      while (text.indexOf('{@') > -1) {
        let info = text.substring(text.indexOf('{@')+1, text.indexOf('}'));
        let type = info.split(' ')[0];
        if (type == '@book') {
          info = info.substring(6).split('|');
          text = text.replace(/{@\w+ ([\w\d\s()×|])+[}]/, `${info[1]}: ${info[0]}`);
        } else if (type == '@condition' || type == '@skill') {
          text = text.replace(/{@\w+ ([\w\d\s()×]+)}/, '[$1]');
        } else if (type == '@filter') {
          text = text.replace(/{@\w+ ([\w\d\s()×]+)[|\w\s\d=()×]+}/, '$1');
        } else {
         text = text.replace(/{@\w+ ([\w\d\s()×]+)[|\w\s\d=()×]+}/, '[$1]');
        }
      }

    } catch (e) {}
    return text;
	};


  /*=======================================================================*
  * JSON Gets on AngularJS INIT
  *========================================================================*/
  $scope.$watch('$viewContentLoaded', function(event){
    /*=======================================================================*
    * Gets Class JSON for Class Menu
    *========================================================================*/
    $http.get('./data/class/classOptions.json').then(function(response){
      var data = response.data
      $scope.classOptions = angular.copy(data);
      $scope.classOptions2 = angular.copy(data);
    });
    /*=======================================================================*
    * Gets Race JSON for Race Menu
    *========================================================================*/
    $http.get('./data/races.json').then(function(response){
		 $scope.races = [];
		 response.data.race.forEach(race => {
			 if (race.subraces) {
				 race.subraces.forEach(subrace => {
					 let temp = angular.copy(race);
					 delete temp.subraces;
					 temp.ability ? subrace.ability ? temp.ability[0] = $.extend(temp.ability[0], subrace.ability[0]) : {} : temp.ability = subrace.ability;
					 subrace.darkvision ? temp.darkvision = subrace.darkvision : {};
					 temp.entries = temp.entries.concat(subrace.entries);
					 subrace.languageProficiencies ? temp.languageProficiencies ? temp.languageProficiencies = temp.languageProficiencies.concat(subrace.languageProficiencies) : temp.languageProficiencies = subrace.languageProficiencies : {};
					 temp.name = subrace.name ? race.name + ' (' + subrace.name + ')' : race.name;
					 subrace.page ? temp.page = subrace.page : {};
					 subrace.size ? temp.size = subrace.size : {};
					 subrace.skillProficiencies ? temp.skillProficiencies ? temp.skillProficiencies = temp.skillProficiencies.concat(subrace.skillProficiencies) : temp.skillProficiencies = subrace.skillProficiencies : {};
					 subrace.soundClip ? temp.soundClip = subrace.soundClip : {};
					 subrace.source ? temp.source = subrace.source : {};
					 subrace.speed ? temp.speed = subrace.speed : {};
					 subrace.traitTags ? temp.traitTags ? temp.traitTags = temp.traitTags.concat(subrace.traitTags) : temp.traitTags = subrace.traitTags : {};
					 $scope.races.push(temp);
				 });
			 }
		 });
    });
    /*=======================================================================*
    * Gets Background JSON for Backgrounds Menu
    *========================================================================*/
    $http.get('./data/backgrounds.json').then(function(response){
      response.data.background.forEach(bk => {
        if(bk._copy){
          response.data.background.forEach(bk2 => {
            if(bk._copy.name == bk2.name){
              bk2.languageProficiencies ? bk.languageProficiencies = bk2.languageProficiencies : {};
              bk2.skillProficiencies ? bk.skillProficiencies = bk2.skillProficiencies: {};
              bk2.toolProficiencies ? bk.toolProficiencies = bk2.toolProficiencies: {};
              bk2.entries ? bk.entries = bk2.entries: {};
              bk2.otherSources ? bk.otherSources = bk2.otherSources: {};
            }
          });
        }
       });
       $scope.backgrounds = response.data.background;
    });
    /*=======================================================================*
    * Gets Book JSON for Book Menu
    *========================================================================*/
    $http.get('./data/books.json').then(function(response){
      $scope.books = response.data.book;
    }).then(function(result){
      // Only needed when default books are selected
      isChecked();
    });
  });

  /*=======================================================================*
  * INIT
  *========================================================================*/
  function init(){
    // These are not connected to what is being showed / what is being rolled at init
    $scope.rollStats4d6k3();
    // Probably a better way of doing This
    $scope.rolledStats = angular.copy($scope.data.char.rolledStats);
    // Is this needed anymore? I dont think so...
    $scope.rollStatsMatrix();
  };
  init();

});
