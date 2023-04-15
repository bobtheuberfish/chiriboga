//CARD DEFINITIONS FOR MIDNIGHT SUN
setIdentifiers.push('ms');

cardSet[33001] = {
  title: 'Esâ Afontov: Eco-Insurrectionist',
  imageFile: "33001.png",
  player: runner,
  link: 0,
  faction: "Anarch",
  cardType: "identity",
  subTypes: ["Cyborg"],
  deckSize: 45,
  influenceLimit: 15,
  firstCoreDamageThisTurn: false,
  sufferedCoreDamageThisTurn: false,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.sufferedCoreDamageThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  responseOnCorpTurnBegins: {
    Resolve: function () {
      this.sufferedCoreDamageThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  //The first time each turn you suffer core damage, you may draw 1 card and sabotage 2
  automaticOnTakeDamage: {
    Resolve: function (damage, damageType) {
      if (!this.sufferedCoreDamageThisTurn && damageType=="core" && damage > 0) {
		  this.firstCoreDamageThisTurn=true;
	  }
    },
    availableWhenInactive: true,
    automatic: true,
  },
  responseOnTakeDamage: {
    Enumerate(damage, damageType) {
		if (this.firstCoreDamageThisTurn && damageType=="core" && damage > 0) {
			//note that this will still fire even if stack is empty (I asked on GLC, answer was: `if Esa said "draw 1 card to sabotage 2" or "draw 1 card. If you do, sabotage 2," then that would indicate a nested cost....As is, you simply complete as much of the instruction as you can.`)
			var triggerChoice = {
			  id: 0,
			  label: "Draw 1 card and sabotage 2",
			  button: "Draw 1 card and sabotage 2",
			};
			var continueChoice = {
			  id: 1,
			  label: "Continue",
			  button: "Continue",
			};
			//**AI code (in this case, implemented by setting and returning the preferred option)
			if (runner.AI != null) {
				//always use if possible
				return [triggerChoice];
			}
			return [triggerChoice,continueChoice];
		}
      return []; //no valid options to use this ability
    },
    Resolve: function (params) {
		this.firstCoreDamageThisTurn=false;
		this.sufferedCoreDamageThisTurn=true;
		if (params.id == 0) {
			//id 0 fires the ability
			Draw(runner, 1, function() {
				Sabotage(2);
			}, this);
		}
		//the other choice is continue
    }
  },
};

cardSet[33002] = {
  title: 'Chastushka',
  imageFile: "33002.png",
  elo: 1682,
  player: runner,
  faction: "Anarch",
  influence: 4,
  subTypes: ["Run","Sabotage"],
  cardType: "event",
  playCost: 3,
  //Run HQ. If successful, instead of breaching HQ, sabotage 4.
  runWasSuccessful: false,
  Resolve: function (params) {
	this.runWasSuccessful = false;
    MakeRun(corp.HQ);
  },
  automaticOnRunSuccessful: {
    Resolve: function (server) {
      this.runWasSuccessful = true;
    }
  },
  specialOnInsteadOfBreaching: {
	Enumerate: function() {
      if (this.runWasSuccessful) return [{required:true}];
      return [];
	},
    Resolve: function (params) {
	  this.runWasSuccessful=false;
	  Sabotage(4)
    },
  },
  AIBreachReplacementValue: 2, //priority 2 (medium)
  //don't define AIWouldPlay for run events, instead use AIRunEventExtraPotential(server,potential) and return float (0 to not play)
  AIRunEventExtraPotential: function(server,potential) {
	  //HQ only
	  if (server == corp.HQ) { 
		  //require successful run
		  if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0;
		  //use only if there are no unrezzed ice/root
		  var cardsThisServer = server.ice.concat(server.root);
		  for (var i=0; i<cardsThisServer.length; i++) {
		    if (!cardsThisServer[i].rezzed) return 0; //might be a waste (don't play)
		  }
		  return 1.2; //arbitrary
	  }
	  return 0; //no benefit (don't play)
  },
  AIBreachNotRequired:true,
  AIPreventBreach: function(server) {
	  if (server == corp.HQ) return true; //cannot breach
	  return false; //allow breach
  },
};

cardSet[33003] = {
  title: "Running Hot",
  imageFile: "33003.png",
  elo: 1579,
  player: runner,
  faction: "Anarch",
  influence: 3,
  cardType: "event",
  playCost: 1,
  additionalPlayCostSufferDamage: { damageType: "core", damage: 1 },
  Resolve: function (params) {
	GainClicks(runner, 3);
  },
  AIWouldPlay: function() {
	//never intentionally flatline
	if (runner.grip.length < 1) return false;
	//if corp looks like they are about to win we'll waive the rest of the requirements and be reckless
	if (AgendaPointsToWin() - AgendaPoints(corp) < 3) return true;
	//require a relatively full hand
    if (runner.AI._currentOverDraw() < 0) return false;
	//require no cardsworthkeeping (don't want to lose them)
	if (runner.AI.cardsWorthKeeping.length > 0) return false;
	//require at least one server to have a cached potential of more than 1.5 (this is roughly in line with Overclock)
	var hps = runner.AI._highestPotentialServer();
	if (!hps) return false;
	if (runner.AI._getCachedPotential(hps) < 1.5) return false;
	return true;
  },
  AIPlayWhenCan: 1, //priority 1 (low)
};

cardSet[33004] = {
  title: "Steelskin Scarring",
  imageFile: "33004.png",
  elo: 1779,
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "event",
  playCost: 1,
  //Draw 3 cards.
  Resolve: function (params) {
    Draw(runner, 3);
  },
  //When this event is trashed from your grip or stack, you may draw 2 cards.
  //need to store where the card was before it is trashed
  trashedFromLocation: null,
  automaticOnWouldTrash: {
	Resolve: function(cards) {
	  if (cards.includes(this)) this.trashedFromLocation = this.cardLocation;
	},
    availableWhenInactive: true
  },
  responseOnTrash: {
	Enumerate: function(cards) {
	  if (cards.includes(this)) {
	    if (this.trashedFromLocation == runner.grip || this.trashedFromLocation == runner.stack) {
		  var drawChoice = { id:0, label:"Draw 2 cards", button:"Draw 2 cards" };
		  var continueChoice = { id:1, label:"Continue", button:"Continue" };
		  //**AI code (in this case, implemented by setting and returning the preferred option)
		  if (runner.AI != null) return [drawChoice]; //always use
		  return [drawChoice, continueChoice];
	    }
	  }
	  return [];
	},
	Resolve: function(params) {
	  if (params.id == 0) Draw(runner, 2);
	},
    availableWhenInactive: true	
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
      //keep if need card draw
      if (runner.grip.length < 3) return true;
	  return false;
  },
  AIWouldPlay: function() {
	//prevent wild overdraw (and try to take into account the one this will burn)
    if (runner.AI._currentOverDraw() + 1 < runner.AI._maxOverDraw()) return true;
	return false;
  },
  AIPlayToDraw: 2, //priority 2 (moderate; it's great for drawing but also good for keeping)
  DuplicateUsability: function() {
	return true; //always autoselect duplicates
  },
};

cardSet[33005] = {
  title: "Ghosttongue",
  imageFile: "33005.png",
  elo: 1708,
  player: runner,
  faction: "Anarch",
  influence: 3,
  cardType: "hardware",
  subTypes: ["Cybernetic"],
  installCost: 2,
  unique: true,
  //When you install this hardware, suffer 1 core damage.
  responseOnInstall: {
	Enumerate: function(card) {
      if (card == this) return [{}];
	  return [];
	},		
    Resolve: function (params) {
	  //damage can be prevented
      Damage("core", 1, true);
    },
  },  
  //The play cost of each event is lowered by 1 credit.
  modifyPlayCost: {
    Resolve: function (card) {
      if (CheckCardType(card, ["event"])) return -1; //1 less to play 
      return 0; //no modification to cost
    },
    automatic: true,
  },
  AILimitPerDeck: 2,
  AIEconomyInstall: function() {
	  //never intentionally flatline
	  if (runner.grip.length < 2) return 0; //don't install
	  //make sure there are enough clicks to draw back up in case we want to
	  var clickAfterPlaying = runner.clickTracker - 1;
	  var handSizeAfterPlaying = MaxHandSize(runner) - 1;
	  var cardsInHandAfterPlaying = runner.grip.length - 2;
	  var cardsToDrawToFullHandAfter = handSizeAfterPlaying - cardsInHandAfterPlaying;
	  if (clickAfterPlaying < cardsToDrawToFullHandAfter) return 0; //don't install 
	  //more event cards means more value
	  //priority is between 0 (don't install right now) and 3 (probably the best option)
	  //in this case we'll limit to 2 (moderate) because it doesn't provide burst econ
	  var eventCardsInGripWithPlayCost = 0;
	  for (var i=0; i<runner.grip.length; i++) {
		if (CheckCardType(runner.grip[i], ["event"])) {
			if (PlayCost(runner.grip[i]) > 0) eventCardsInGripWithPlayCost++;
		}
	  }
	  return Math.min(eventCardsInGripWithPlayCost,2);
  },
  /*
  //could install before run but...the core damage...
  //(this code is from Prepaid VoicePAD)
  //unlike Prepaid VoicePAD we don't need AIRunEventDiscount because run calculations will use PlayCost not printed cost
  AIInstallBeforeRun: function(server,potential,useRunEvent,runCreditCost,runClickCost) {
	  //only if the run will be initiated with an event card
	  if (useRunEvent) {
		  //extra costs of install have already been considered, so yes install it
		  return 1; //yes
	  }
	  return 0; //no
  },
  */
};

cardSet[33006] = {
  title: "Marrow",
  imageFile: "33006.png",
  elo: 1566,
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "hardware",
  subTypes: ["Console","Cybernetic"],
  installCost: 2,
  unique: true,
  memoryUnits: 1,
  //You get +3 maximum hand size.
  modifyMaxHandSize: {
    Resolve: function (player) {
      if (player == runner) return 3; //+3
      return 0; //no modification to maximum hand size
    },
  },
  //When you install this hardware, suffer 1 core damage.
  responseOnInstall: {
	Enumerate: function(card) {
      if (card == this) return [{}];
	  return [];
	},		
    Resolve: function (params) {
	  //damage can be prevented
      Damage("core", 1, true);
    },
  },  
  //Whenever the Corp scores an agenda, sabotage 1.
  responseOnScored: {
    Resolve: function (params) {
      Sabotage(1);
    },
  },
};

cardSet[33007] = {
  title: "Begemot",
  imageFile: "33007.png",
  elo: 1555,
  player: runner,
  faction: "Anarch",
  influence: 4,
  cardType: "program",
  subTypes: ["Icebreaker", "Fracter"],
  memoryCost: 2,
  installCost: 5,
  strength: 2,
  //When you install this program, suffer 1 core damage.
  responseOnInstall: {
	Enumerate: function(card) {
      if (card == this) return [{}];
	  return [];
	},		
    Resolve: function (params) {
	  //damage can be prevented
      Damage("core", 1, true);
    },
  },  
  //This program gets +1 strength for each core damage you have taken this game.
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return runner.coreDamage;
      return 0; //no modification to strength
    },
  },
  //Interface -> 1[c]: Break any number of barrier subroutines.
  //basically the approach is have a SharedDecisionCallback that can be used recursively
  SharedDecisionCallback: function(params) {
	if (typeof params != 'undefined') {
	  if (typeof params.subroutine != 'undefined') {
		Break(params.subroutine);
	  }
	  else return; //done breaking
	}
	var choices = ChoicesEncounteredSubroutines();
	if (choices.length < 1) return; //done breaking
	for (var i = 0; i < choices.length; i++) {
	  choices[i].label =
		"(Begemot) Break another subroutine. -> " + choices[i].label;
	}
	choices.push({
	  id: choices.length,
	  label: "Continue",
	  button: "Continue",
	});
	DecisionPhase(
	  runner,
	  choices,
	  this.SharedDecisionCallback,
	  "Break any number of barrier subroutines",
	  "Begemot",
	  this
	);
  },
  abilities: [
    {
      text: "Break any number of barrier subroutines",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Barrier"))
          return [];
        if (!CheckCredits(runner, 1, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        //None isn't a valid option because it doesn't try to change the game state
        //See NISEI Comprehensive Rules 1.2.5 (https://nisei.net/wp-content/uploads/2021/03/Comprehensive_Rules.pdf)
        //So my chosen implementation is: choose first to break, then any further options are optional.
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
		  function() {
			Break(params.subroutine);
			this.SharedDecisionCallback();
		  },
          this
        );
      },
    },
  ],
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    result = result.concat(
        rc.ImplementIcebreaker(
          point,
          this,
          cardStrength,
          iceAI,
          iceStrength,
          ["Barrier"],
          Infinity, //fixed strength breaker
          0,
          1,
          iceAI.sr.length, //break any number (don't use Infinity here because all combinations of break/leave unbroken are considered)
          creditsLeft
        )
    ); //cost to str, amt to str, cost to brk, amt to brk
	return result;
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't install if this is last click
	if (runner.clickTracker < 2) return -1; //don't install
	//never intentionally flatline
	if (runner.grip.length < 2) return -1; //don't install
    return 0; //do install
  },
};

cardSet[33008] = {
  title: "Avgustina Ivanovskaya",
  imageFile: "33008.png",
  elo: 1431,
  player: runner,
  faction: "Anarch",
  influence: 1,
  cardType: "resource",
  subTypes: ["Connection"],
  installCost: 1,
  unique: true,
  //The first time each turn you install a virus program, sabotage 1.
  installedVirusProgramThisTurn: false,
  firstVirusProgramInstall: null,
  responseOnRunnerTurnBegins: {
    Resolve: function () {
      this.installedVirusProgramThisTurn = false;
	  this.firstVirusProgramInstall = null;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  responseOnCorpTurnBegins: {
    Resolve: function () {
      this.installedVirusProgramThisTurn = false;
	  this.firstVirusProgramInstall = null;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  automaticOnInstall: {
    Resolve: function (card) {
	  if (!this.installedVirusProgramThisTurn && !this.firstVirusProgramInstall) {
        if (CheckCardType(card, ["program"])) {
          if (CheckSubType(card, "Virus")) {
		    this.installedVirusProgramThisTurn = true;
		    this.firstVirusProgramInstall = card;
		  }
        }
	  }
	  else this.firstVirusProgramInstall = null;
    },
	availableWhenInactive: true,
  },
  responseOnInstall: {
	Enumerate: function(card) {
      if (card == this.firstVirusProgramInstall) return [{}];
	  return [];
	},		
    Resolve: function (params) {
	  this.firstVirusProgramInstall = null;
	  Sabotage(1);
    },
  },
  //require two clicks spare for run, require virus card in hand with AIInstallBeforeRun > 0, and enough spare credits to still run after installing both
  AIInstallBeforeRun: function(server,potential,useRunEvent,runCreditCost,runClickCost) {
	  if (runClickCost < runner.clickTracker - 2) {
		  for (var i=0; i<runner.grip.length; i++) {
			  if (CheckSubType(runner.grip[i],"Virus")) {
				if (typeof runner.grip[i].AIInstallBeforeRun == "function") {
					var virusIBRPriority = runner.grip[i].AIInstallBeforeRun.call(runner.grip[i],server,potential,useRunEvent,runCreditCost,runClickCost);
					if (virusIBRPriority > 0) {
						if ( runCreditCost <= AvailableCredits(runner) - InstallCost(this) - InstallCost(runner.grip[i]) ) {
							return virusIBRPriority + 1; //yes, at higher priority than that virus card
						}
					}
				}
			  }
		  }
	  }
	  return 0; //no
  },
  AIInstallBeforeInstall: function(cardToInstall) {
	//return true to install this before cardToInstall
	//in this case we'll just require sufficient credits for both (could require clicks/mu too but will go with this for now)
	if (CheckSubType(cardToInstall,"Virus")) {
		if ( AvailableCredits(runner) >= InstallCost(this) - InstallCost(cardToInstall) ) {
			return true; //i.e. don't install cardToInstall until this has been installed
		}
	}
	return false; //i.e. ok to install cardToInstall first
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if any virus cards in hand
	  for (var j = 0; j < runner.grip.length; j++) {
		if (CheckSubType(runner.grip[j], "Virus")) {
		  return true;
		  break;
		}
	  }
	  return false;
  },
};