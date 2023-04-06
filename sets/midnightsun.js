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

/*
cardSet[33003] = {
  title: "Running Hot",
  imageFile: "33003.png",
  //elo: ,
  player: runner,
  faction: "Anarch",
  influence: 3,
  cardType: "event",
  playCost: 1,
  Resolve: function (params) {
    //TODO the core damage should be an additional cost, not an effect (this matters in case there is an 'ignoring all costs' way to play it)
	Damage("core", 1, function(){
		GainClicks(runner, 3);
	}, this);
  },
};
*/