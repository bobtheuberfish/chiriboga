//CARD DEFINITIONS FOR SYSTEM GATEWAY
//elo values (higher is better) are from https://trash-or-busto.herokuapp.com/ranking at 26 Apr 2022
setIdentifiers.push('sg');
cardSet[30001] = {
  title: 'René "Loup" Arcemont: Party Animal',
  imageFile: "30001.png",
  elo: 1598,
  player: runner,
  faction: "Anarch",
  link: 0,
  cardType: "identity",
  deckSize: 40,
  influenceLimit: 15,
  usedThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  //need to store whether the card was being accessed (once it's trashed, the access immediately ends)
  wasAccessingCard: false,
  trash: {
	Resolve: function() {
	  if (intended.trash == accessingCard) this.wasAccessingCard = true;
	},
	automatic: true,
  },
  cardTrashed: {
    Resolve: function (card) {
      if (this.wasAccessingCard && !this.usedThisTurn) {
        this.usedThisTurn = true;
		this.wasAccessingCard = false;
        GainCredits(runner, 1);
        Draw(runner, 1);
      }
    },
  },
};
cardSet[30002] = {
  title: "Wildcat Strike",
  imageFile: "30002.png",
  elo: 1620,
  player: runner,
  faction: "Anarch",
  influence: 1,
  cardType: "event",
  playCost: 2,
  //Resolve 1 of the Corp's choice: Gain 6[c] or Draw 4 cards.
  Resolve: function (params) {
    var choices = [];
    choices.push({
      id: 0,
      label: "Gain 6 credits",
      button: "Runner gains 6[c]",
    });
    choices.push({
      id: 1,
      label: "Draw 4 cards",
      button: "Runner draws 4 cards",
    });
    function decisionCallback(params) {
      if (params.id == 0) {
        GainCredits(runner, 6);
      } else {
        Draw(runner, 4);
      }
    }
    DecisionPhase(
      corp,
      choices,
      decisionCallback,
      "Wildcat Strike",
      "Wildcat Strike",
      this
    );
    //**AI code
    if (corp.AI != null) {
      corp.AI._log("I know this one");
      var choice = choices[1];
      if (
        Credits(runner) - PlayerHand(runner).length + runner.clickTracker >=
        9 - MaxHandSize(runner)
      )
        choice = choices[0];
      corp.AI.preferred = { title: "Wildcat Strike", option: choice };
    }
  },
  AIWouldPlay: function() {
	//prevent wild overdraw
    if (runner.AI._currentOverDraw() + 1 < runner.AI._maxOverDraw()) return true;
	return false;
  },
  AIPlayToDraw: 1, //priority 1 (yes play but there are better options)
};
cardSet[30003] = {
  title: "Carnivore",
  imageFile: "30003.png",
  elo: 1469,
  player: runner,
  faction: "Anarch",
  influence: 3,
  cardType: "hardware",
  subTypes: ["Console"],
  installCost: 4,
  unique: true,
  memoryUnits: 1,
  //Access > Trash 2 cards from your grip: Trash the card you are accessing. Use this ability only once per turn.
  usedThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  abilities: [
    {
      text: "Trash 2 cards from your grip: Trash the card you are accessing.",
      Enumerate: function () {
        if (this.usedThisTurn) return [];
        if (!CheckAccessing()) return [];
        if (!CheckTrash(accessingCard)) return []; ////not already in the trash, not disallowed
        if (PlayerHand(runner).length < 2) return [];
        return [{}];
      },
      Resolve: function (params) {
        this.usedThisTurn = true;
        var choices = ChoicesArrayCards(runner.grip);
        DecisionPhase(
          runner,
          choices,
          function (params) {
            Trash(
              params.card,
              false,
              function () {
                //false means it can't be prevented
                choices = ChoicesArrayCards(runner.grip);
                DecisionPhase(
                  runner,
                  choices,
                  function (params) {
                    Trash(
                      params.card,
                      false,
                      function () {
                        //false means it can't be prevented
                        TrashAccessedCard(true); //true means it can be prevented (it is not a cost)
                      },
                      this
                    );
                  },
                  null,
                  "Discard",
                  this,
                  "trash"
                ); //"Discard" was "Carnivore" but current implementation uses "Discard" as a hint to show an instruction
              },
              this
            );
          },
          null,
          "Discard",
          this,
          "trash"
        ); //"Discard" was "Carnivore" but current implementation uses "Discard" as a hint to show an instruction
      },
    },
  ],
  AIReducesTrashCost: function(card) {
    if (this.usedThisTurn) return 0; //no reduction to trash cost
	if (runner.grip.length - runner.AI.cardsWorthKeeping.length < 2) return 0; //no reduction to trash cost
	return TrashCost(card); //reduction by its full trash cost
  },
};
cardSet[30004] = {
  title: "Botulus",
  imageFile: "30004.png",
  elo: 1817,
  player: runner,
  faction: "Anarch",
  influence: 3,
  cardType: "program",
  subTypes: ["Virus"],
  installCost: 2,
  memoryCost: 1,
  //Install only on a piece of ice.
  installOnlyOn: function (card) {
    if (!CheckCardType(card, ["ice"])) return false;
    return true;
  },
  //When you install this program and when your turn begins, place 1 virus counter on this program.
  cardInstalled: {
    Resolve: function (card) {
      if (card == this) AddCounters(this, "virus", 1);
    },
  },
  runnerTurnBegin: {
    Resolve: function () {
      AddCounters(this, "virus", 1);
    },
    automatic: true, //for usability, this is not strict implementation
  },
  //Hosted virus counter: Break 1 subroutine on host ice.
  abilities: [
    {
      text: "Break 1 subroutine on host ice",
      Enumerate: function () {
        if (!CheckCounters(this, "virus", 1)) return [];
        if (!CheckEncounter()) return [];
        if (attackedServer.ice[approachIce] != this.host) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        RemoveCounters(this, "virus", 1);
        Break(params.subroutine);
      },
    },
  ],
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	  //only target ice that don't already have a special breaker hosted
	  var htsi = runner.AI._highestThreatScoreIce([this].concat(runner.AI._iceHostingSpecialBreakers()));
	  if (htsi)  {
		//find it in the choices list
		for (var i = 0; i < choices.length; i++) {
			if (htsi == choices[i].host) return i;
		}
	  }
	  return -1; //don't install
  },
  //acts like an icebreaker but doesn't have that subtype (or can be used on any subtype of ice)
  AISpecialBreaker:true,
  //for when not currently installed, hypothesise
  AIPrepareHypotheticalForRC:function(preferredHost) {
	this.host = preferredHost;
	this.virus=1;
  },
  AIRestoreHypotheticalFromRC:function() {
	this.host = null;
	this.virus=0;
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    if (this.host == iceAI.ice) {
        var sr_broken_by_this = 0;
        for (var i = 0; i < point.sr_broken.length; i++) {
          if (point.sr_broken[i].use == this) sr_broken_by_this++;
        }
        if (sr_broken_by_this < Counters(this, "virus")) {
          //number of sr_broken by this card cannot exceed hosted virus counters
          result = result.concat(rc.SrBreak(this, iceAI, point, 1)); //break 1 subroutine
        }
    }
	return result;
  },
  AIMatchingBreakerInstalled: function (iceCard) {
	//returns a matching breaker installed, or null
	if (this.host) {
		var knownToBeDisabled = false;
		if (PlayerCanLook(runner, this.host)) knownToBeDisabled = this.host.AIDisablesHostedPrograms;
		if (iceCard == this.host && !knownToBeDisabled) return this;
	}
	return null;
  },
  AIOkToTrash: function() {
	  //ok to trash if it has lost its abilities
	  if (this.host) {
		  if (this.host.AIDisablesHostedPrograms) return true; //do trash
	  }
	  return false; //don't trash
  },
};
cardSet[30005] = {
  title: "Buzzsaw",
  imageFile: "30005.png",
  elo: 1615,
  player: runner,
  faction: "Anarch",
  influence: 1,
  cardType: "program",
  subTypes: ["Icebreaker", "Decoder"],
  memoryCost: 1,
  installCost: 4,
  strength: 3,
  //Interface -> 1[c]: Break up to 2 code gate subroutines.
  //3[c]: +1 strength.
  strengthBoost: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return this.strengthBoost;
      return 0; //no modification to strength
    },
  },
  abilities: [
    {
      text: "Break up to 2 code gate subroutines",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Code Gate"))
          return [];
        if (!CheckCredits(runner, 1, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        //None isn't a valid option because it doesn't try to change the game state
        //See NISEI Comprehensive Rules 1.2.5 (https://nisei.net/wp-content/uploads/2021/03/Comprehensive_Rules.pdf)
        //So my chosen implementation is: choose first to break, then second one is optional.
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
            var choices = ChoicesEncounteredSubroutines();
            for (var i = 0; i < choices.length; i++) {
              choices[i].label =
                "(Buzzsaw) Break another subroutine. -> " + choices[i].label;
            }
            //for now we'll force the runner AI to use both breaks - may need to change this later
            if (runner.AI == null || choices.length == 0)
              choices.push({
                id: choices.length,
                label: "Continue",
                button: "Continue",
              });
            DecisionPhase(
              runner,
              choices,
              function (params) {
                if (typeof params.subroutine !== "undefined")
                  Break(params.subroutine);
              },
              "Break up to 2 code gate subroutines",
              "Buzzsaw",
              this
            );
          },
          this
        );
      },
    },
    {
      text: "+1 strength.",
      Enumerate: function () {
        if (!CheckEncounter()) return []; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
        if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
        if (!CheckUnbrokenSubroutines()) return []; //as above
        if (!CheckSubType(attackedServer.ice[approachIce], "Code Gate"))
          return []; //as above.
        if (!CheckCredits(runner, 3, "using", this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          3,
          "using",
          this,
          function () {
            BoostStrength(this, 1);
          },
          this
        );
      },
    },
  ],
  encounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    result = result.concat(
        rc.ImplementIcebreaker(
          point,
          this,
          cardStrength,
          iceAI,
          iceStrength,
          ["Code Gate"],
          3,
          1,
          1,
          2,
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
    return 0; //do install
  },
};
cardSet[30006] = {
  title: "Cleaver",
  imageFile: "30006.png",
  elo: 1599,
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "program",
  subTypes: ["Icebreaker", "Fracter"],
  memoryCost: 1,
  installCost: 3,
  strength: 3,
  //Interface -> 1[c]: Break up to 2 barrier subroutines.
  //2[c]: +1 strength.
  strengthBoost: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return this.strengthBoost;
      return 0; //no modification to strength
    },
  },
  abilities: [
    {
      text: "Break up to 2 barrier subroutines",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Barrier"))
          return [];
        if (!CheckCredits(runner, 1, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        //None isn't a valid option because it doesn't try to change the game state
        //See NISEI Comprehensive Rules 1.2.5 (https://nisei.net/wp-content/uploads/2021/03/Comprehensive_Rules.pdf)
        //So my chosen implementation is: choose first to break, then second one is optional.
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
            var choices = ChoicesEncounteredSubroutines();
            for (var i = 0; i < choices.length; i++) {
              choices[i].label =
                "(Cleaver) Break another subroutine. -> " + choices[i].label;
            }
            choices.push({
              id: choices.length,
              label: "Continue",
              button: "Continue",
            });
            DecisionPhase(
              runner,
              choices,
              function (params) {
                if (typeof params.subroutine !== "undefined")
                  Break(params.subroutine);
              },
              "Break up to 2 barrier subroutines",
              "Cleaver",
              this
            );
          },
          this
        );
      },
    },
    {
      text: "+1 strength.",
      Enumerate: function () {
        if (!CheckEncounter()) return []; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
        if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
        if (!CheckUnbrokenSubroutines()) return []; //as above
        if (!CheckSubType(attackedServer.ice[approachIce], "Barrier"))
          return []; //as above.
        if (!CheckCredits(runner, 2, "using", this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          2,
          "using",
          this,
          function () {
            BoostStrength(this, 1);
          },
          this
        );
      },
    },
  ],
  encounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
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
          2,
          1,
          1,
          2,
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
    return 0; //do install
  },
};
cardSet[30007] = {
  title: "Fermenter",
  imageFile: "30007.png",
  elo: 1685,
  player: runner,
  faction: "Anarch",
  influence: 2,
  cardType: "program",
  subTypes: ["Virus"],
  installCost: 1,
  memoryCost: 1,
  //When you install this program and when your turn begins, place 1 virus counter on this program.
  cardInstalled: {
    Resolve: function (card) {
      if (card == this) AddCounters(this, "virus", 1);
    },
  },
  runnerTurnBegin: {
    Resolve: function () {
      AddCounters(this, "virus", 1);
    },
    automatic: true, //for usability, this is not strict implementation
  },
  //[click],[trash]: Gain 2[c] for each hosted virus counter.
  abilities: [
    {
      text: "Gain 2[c] for each hosted virus counter",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        if (!CheckCounters(this, "virus", 1)) return []; //I suppose you could take zero credits but for usability let's check
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        var creditsToGain = 2 * Counters(this, "virus");
        Trash(this, false); //false means it cannot be prevented (because it's a cost)
        GainCredits(runner, creditsToGain);
      },
    },
  ],
  AIWouldTrigger: function () {
    //don't trigger if less than 3 virus counters
    if (!CheckCounters(this, "virus", 3)) return false;
    return true;
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if need money
	  if (Credits(runner) < 5) return true;
	  return false;
  },
  AIEconomyInstall: function() {
	  return 1; //priority 1 (yes install but there are better options)
  },
  AIEconomyTrigger: 2, //priority 2 (moderate)
};
cardSet[30008] = {
  title: "Leech",
  imageFile: "30008.png",
  elo: 1695,
  player: runner,
  faction: "Anarch",
  influence: 1,
  cardType: "program",
  subTypes: ["Virus"],
  installCost: 1,
  memoryCost: 1,
  strengthReduce: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (!CheckEncounter()) return 0;
      if (card == attackedServer.ice[approachIce]) return this.strengthReduce;
      return 0; //no modification to strength
    },
  },
  encounterEnds: {
    Resolve: function () {
      this.strengthReduce = 0;
    },
    automatic: true,
  },
  runSuccessful: {
    Resolve: function () {
      //central servers only
      if (typeof attackedServer.cards !== "undefined")
        AddCounters(this, "virus", 1);
    },
    automatic: true, //for usability, this is not strict implementation (if you change this, you'll probably need to move the check from Resolve into an Enumerate)
  },
  abilities: [
    {
      text: "Hosted virus counter: The ice you are encountering gets -1 strength for the remainder of this encounter.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckCounters(this, "virus", 1)) return [];
		if (GetApproachEncounterIce().strengthCannotBeLowered) return [];
        if (ChoicesEncounteredSubroutines().length == 0) return []; //for usability only, not strictly required
        return [{}];
      },
      Resolve: function (params) {
        RemoveCounters(this, "virus", 1);
        this.strengthReduce--;
      },
    },
  ],
  AIPermitMoreLeeches: function(installedRunnerCards) {
	//arbitrary but basically make sure there is at least 3 mu of other things (or unused)
	var maxLeeches = MemoryUnits() - 3;
	var numLeeches = 0;
	for (var i=0; i<installedRunnerCards.length; i++) {
		if (GetTitle(installedRunnerCards[i]) == "Leech") numLeeches++;
	}
	return (numLeeches < maxLeeches);
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't use up too much mu on just leeches (just assuming destination is program row, for now)
	var installedRunnerCards = InstalledCards(runner);
	if (this.AIPermitMoreLeeches(installedRunnerCards)) {
		//install leech if there is a breaker in play with lower strength than a matching ice
		var installedCorpCards = InstalledCards(corp);
		for (var i = 0; i < installedCorpCards.length; i++) {
		  var card = installedCorpCards[i];
		  //don't cheat i.e. only check ice that is known
		  if (card.rezzed || card.knownToRunner) {
			if (CheckCardType(card, ["ice"])) {
			  var matchingBreaker = runner.AI._matchingBreakerInstalled(card);
			  if (matchingBreaker) {
				  if (Strength(matchingBreaker) < Strength(card)) return 0; //do install
			  }
			}
		  }
		}
		//or a fixed strength breaker
		for (var i=0; i<installedRunnerCards.length; i++) {
		  if (installedRunnerCards[i].AIFixedStrength) return 0; //do install
		}
	}
	return -1; //don't install
	/* previous algorithm
    //don't install leech if there is any rezzed ice that we don't have a matching breaker for (or no rezzed ice)
    var installedCorpCards = InstalledCards(corp);
    var numRezzedIce = 0;
    for (var i = 0; i < installedCorpCards.length; i++) {
      var card = installedCorpCards[i];
      if (card.rezzed || card.knownToRunner) {
        //don't cheat
        if (CheckCardType(card, ["ice"])) {
          if (!runner.AI._matchingBreakerInstalled(card)) return -1; //don't install
        }
        numRezzedIce++;
      }
    }
    if (numRezzedIce == 0) return -1; //don't install
    return 0; //do install
	*/
  },
  //install before run if the server is central
  AIInstallBeforeRun: function(server,potential,useRunEvent,runCreditCost,runClickCost) {
	  if (typeof server.cards !== "undefined") return 1; //yes
	  return 0; //no
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if a fixed strength card is installed, there is spare mu, and max leeches not met
	  if (spareMU > 0 && this.AIPermitMoreLeeches(installedRunnerCards)) {
		  for (var i=0; i<installedRunnerCards.length; i++) {
			if (installedRunnerCards[i].AIFixedStrength) return true;
		  }
	  }
	  return false;
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	if (iceAI.ice.strengthCannotBeLowered) return result;
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
      var str_mod_by_this = 0;
      for (var i = 0; i < point.card_str_mods.length; i++) {
        if (point.card_str_mods[i].use == this) str_mod_by_this++;
      }
      if (str_mod_by_this < Counters(this, "virus")) {
        //number of str_mod by this card cannot exceed hosted virus counters
        var modifyresult = rc.StrModify(this, iceAI.ice, point, -1, true); //-1 strength, the true stores this past the encounter
        modifyresult.virus_counters_spent += 1;
        result = result.concat(modifyresult);
      }
	return result;
  },
};
cardSet[30009] = {
  title: "Cookbook",
  imageFile: "30009.png",
  elo: 1617,
  player: runner,
  faction: "Anarch",
  influence: 3,
  cardType: "resource",
  subTypes: ["Virtual"],
  installCost: 1,
  unique: true,
  //Whenever you install a virus program, you may place 1 virus counter on it.
  cardInstalled: {
    Resolve: function (card) {
      if (CheckCardType(card, ["program"])) {
        if (CheckSubType(card, "Virus")) AddCounters(card, "virus", 1);
      }
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
						if ( runCreditCost < AvailableCredits(runner) - InstallCost(this) - InstallCost(runner.grip[i]) ) {
							return virusIBRPriority + 1; //yes, at higher priority than that virus card
						}
					}
				}
			  }
		  }
	  }
	  return 0; //no
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
cardSet[30010] = {
  title: "Zahya Sadeghi: Versatile Smuggler",
  imageFile: "30010.png",
  elo: 1652,
  player: runner,
  faction: "Criminal",
  link: 0,
  cardType: "identity",
  deckSize: 40,
  influenceLimit: 15,
  subTypes: ["Cyborg"],
  usedThisTurn: false,
  cardsAccessedThisRun: 0,
  runnerTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  runBegins: {
    Resolve: function (server) {
      this.cardsAccessedThisRun = 0;
    },
    automatic: true,
  },
  cardAccessed: {
    Resolve: function () {
      this.cardsAccessedThisRun += 1;
    },
    automatic: true,
  },
  runEnds: {
    Enumerate: function () {
      if (!this.usedThisTurn) {
        if (
          (attackedServer == corp.HQ || attackedServer == corp.RnD) &&
          this.cardsAccessedThisRun > 0
        )
          return [{}];
      }
      return [];
    },
    Resolve: function (params) {
      var choices = BinaryDecision(
        runner,
        "Gain " + this.cardsAccessedThisRun + "[c]",
        "Continue",
        "Zahya Sadeghi",
        this,
        function () {
          this.usedThisTurn = true;
          GainCredits(runner, this.cardsAccessedThisRun);
        }
      );
      //**AI code
      if (runner.AI != null) {
        runner.AI._log("I know this one");
        var choice = choices[0]; //always gain the credits (there may not be another opportunity this turn)
        runner.AI.preferred = { title: "Zahya Sadeghi", option: choice }; //title must match currentPhase.title for AI to fire
      }
    },
  },
};
cardSet[30011] = {
  title: "Mutual Favor",
  imageFile: "30011.png",
  elo: 1745,
  player: runner,
  faction: "Criminal",
  influence: 3,
  cardType: "event",
  playCost: 0,
  //Search your stack for 1 icebreaker program and reveal it. (Shuffle your stack after searching it.)
  //If you made a successful run this turn, you may install it.
  madeSuccessfulRunThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.madeSuccessfulRunThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  runSuccessful: {
    Resolve: function () {
      this.madeSuccessfulRunThisTurn = true;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  Enumerate: function () {
    var choices = ChoicesArrayCards(runner.stack, function (card) {
      if (!CheckCardType(card, ["program"])) return false;
      return CheckSubType(card, "Icebreaker");
    });
    //**AI code (in this case, implemented by setting and returning the preferred option)
    if (runner.AI != null && choices.length > 0) {
      var choice = choices[0]; //choose arbitrary by default in case algorithm fails
      var preferredcard = runner.AI._icebreakerInPileNotInHandOrArray(
	    runner.stack,
        InstalledCards(runner)
      );
      for (var i = 0; i < choices.length; i++) {
        if (choices[i].card == preferredcard) choice = choices[i];
      }
      return [choice];
    }
    //otherwise return choices for human player
    return choices;
  },
  Resolve: function (params) {
    Shuffle(runner.stack);
    MoveCard(params.card, runner.resolvingCards);
    Reveal(
      params.card,
      function () {
        params.card.faceUp = true; //because this fires after reveal is finished
        this.installingCard = params.card;
        var choices = [];
        if (this.madeSuccessfulRunThisTurn) {
          //provide option to install it, if affordable
          if (ChoicesCardInstall(params.card).length > 0) {
            //I'm not sure this card implementation would handle hosting with multiple target options - test when relevant
            choices.push({
              id: 0,
              label: "Install " + GetTitle(params.card),
              button: "Install " + GetTitle(params.card),
            });
          }
        }
        choices.push({
          id: 1,
          label: "Add " + GetTitle(params.card) + " to grip",
          button: "Add " + GetTitle(params.card) + " to grip",
        });
        var installedCallback = function () {};
        var notInstalledCallback = function () {
          MoveCard(this.installingCard, runner.grip);
          Log(GetTitle(this.installingCard) + " added to grip");
        };
        var decisionCallback = function (params) {
          if (params.id == 0) {
            //install it
            Install(
              this.installingCard,
              null,
              false,
              null,
              true,
              installedCallback,
              this,
              notInstalledCallback
            );
          }
          //If you do not [install it], add it to your grip.
          else notInstalledCallback.call(this);
        };
        DecisionPhase(
          runner,
          choices,
          decisionCallback,
          "Mutual Favor",
          "Mutual Favor",
          this
        );
        //**AI code
        if (runner.AI != null && choices.length > 0) {
          runner.AI._log("I know this one");
          var choice = choices[0]; //choose install if possible
          runner.AI.preferred = { title: "Mutual Favor", option: choice }; //title must match currentPhase.title for AI to fire
        }
      },
      this
    );
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if have a spare mu and a breaker type in deck thats not in hand or play
	  if (spareMU > 0) {
		var worthBreaker =
		  runner.AI._icebreakerInPileNotInHandOrArray(runner.stack,installedRunnerCards);
		if (worthBreaker) {
		  //if a successful run has already been made this turn and can afford the install, then Mutual Favor is efficient
		  if (
			this.madeSuccessfulRunThisTurn &&
			CheckCredits(runner, InstallCost(worthBreaker), "installing")
		  )
			return true;
		  //otherwise don't Mutual Favor if there's already a breaker in hand worth playing...
		  else {
			var essentials =
			  runner.AI._essentialBreakerTypesNotInArray(installedRunnerCards);
			var worthBreakersInHand = false;
			for (var j = 0; j < runner.grip.length; j++) {
			  for (var k = 0; k < essentials.length; k++) {
				if (CheckSubType(runner.grip[j], essentials[k])) {
				  worthBreakersInHand = true;
				  break;
				}
			  }
			  if (worthBreakersInHand) break;
			}
			if (!worthBreakersInHand) return true;
		  }
		}
	  }
	  return false;
  },
  //get list of icebreakers that AI might tutor by this
  AIIcebreakerTutor: function(installedRunnerCards) {
	  return runner.AI._icebreakerInPileNotInHandOrArray(runner.stack,installedRunnerCards);
  },
};
cardSet[30012] = {
  title: "Tread Lightly",
  imageFile: "30012.png",
  elo: 1647,
  player: runner,
  faction: "Criminal",
  influence: 1,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 1,
  //Run any server. During that run, the rez cost of any piece of ice is increased by 3[c].
  Enumerate: function () {
    return ChoicesExistingServers();
  },
  Resolve: function (params) {
    MakeRun(params.server);
  },
  modifyRezCost: {
    Resolve: function (card) {
      if (CheckCardType(card, ["ice"])) return 3;
      return 0; //no modification to cost
    },
  },
  //don't define AIWouldPlay for run events, instead use AIRunEventExtraPotential(server,potential) and return float (0 to not play)
  AIRunEventExtraPotential: function(server,potential) {
	  //use Tread Lightly for high value targets or targets with multiple unrezzed ice (unless Corp is super rich)
	  var unrezzedIceThisServer = 0;
	  for (var i = 0; i < server.ice.length; i++) {
		if (!server.ice[i].rezzed) unrezzedIceThisServer++;
	  }
	  if (potential > 1.5 || unrezzedIceThisServer > 1) {
        if (AvailableCredits(corp) < 5 + 5 * unrezzedIceThisServer + runner.creditPool) {
		  //the runner.creditPool part is that the Runner can be more comfortable using it if rich
		  return 0.1 * unrezzedIceThisServer; //slight extra potential for taxing the corp
		}
	  }
	  return 0; //no benefit (don't play)
  },
  //make temporary changes during run calculations
  AIRunEventModify: function(server) {
	this.storedCorpCreditPool = corp.creditPool; 
	corp.creditPool -= 3;
  },
  //then restore from changes afterwards
  AIRunEventRestore: function(server) {
	corp.creditPool = this.storedCorpCreditPool;
  },
};
cardSet[30013] = {
  title: "Docklands Pass",
  imageFile: "30013.png",
  elo: 1704,
  player: runner,
  faction: "Criminal",
  influence: 2,
  cardType: "hardware",
  installCost: 2,
  unique: true,
  //The first time each turn you breach HQ, access 1 additional card.
  breachedHQThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.breachedHQThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  breachServer: {
	//NOTE: breachServer may be called multiple times (e.g. when determining new candidates)
    Resolve: function () {
      if (attackedServer != corp.HQ) return 0;
      if (this.breachedHQThisTurn) return 0; //first time only
      return 1;
    },
  },
  runEnds: {
    Resolve: function () {
	  this.breachedHQThisTurn = true; //even if inactive
	},
	automatic:true,
	availableWhenInactive: true,
  },
  //indicate when passive bonus to accesses will apply
  //(assumes the card is or will be active)
  AIAdditionalAccess: function(server) {
      if (server != corp.HQ) return 0;
      if (this.breachedHQThisTurn) return 0; //first time only
      return 1;
  },
  //install before run if the server is HQ and Docklands is in worthkeeping
  AIInstallBeforeRun: function(server,potential,useRunEvent,runCreditCost,runClickCost) {
	if (server == corp.HQ) {
		if (runner.AI.cardsWorthKeeping.includes(this)) return 1; //yes
	}
	return 0; //no
  },	  		  
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if run into HQ is possible and HQ hasn't been breached this turn
	  var keep = false;
	  if (!this.breachedHQThisTurn && runner.clickTracker > 1) {
		var storedCWK = runner.AI.cardsWorthKeeping; //oversimplified workaround for the fact that docklands will consider HQ unrunnable if it is in hand and might be lost...
		runner.AI.cardsWorthKeeping = [];
		if (runner.AI._getCachedCost(corp.HQ) != Infinity) keep = true;
		runner.AI.cardsWorthKeeping = storedCWK;
	  }
	  return keep;
  },
};
cardSet[30014] = {
  title: "Pennyshaver",
  imageFile: "30014.png",
  elo: 1753,
  player: runner,
  faction: "Criminal",
  influence: 3,
  cardType: "hardware",
  subTypes: ["Console"],
  installCost: 3,
  unique: true,
  memoryUnits: 1,
  credits: 0,
  //Whenever you make a successful run, place 1[c] on this hardware.
  //[click]: Place 1[c] on this hardware, then take all credits from it.
  runSuccessful: {
    Resolve: function () {
      PlaceCredits(this, 1);
    },
    automatic: true,
  },
  abilities: [
    {
      text: "Place 1[c] on this hardware, then take all credits from it.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        PlaceCredits(this, 1); //1 credit from bank
        TakeCredits(runner, this, this.credits); //removes from card, adds to credit pool
      },
    },
  ],
  AIWouldTrigger: function () {
    //don't trigger as just a click-for-credit during overdraw
    if (runner.grip.length > MaxHandSize(runner)) {
      if (!CheckCounters(this, "credits", 1)) return false;
    }
    return true;
  },
  AIEconomyInstall: function() {
	  return 2; //priority 2 (moderate)
  },
  AIEconomyTrigger: 1, //priority 1 (yes trigger but there are better options)
};
cardSet[30015] = {
  title: "Carmen",
  imageFile: "30015.png",
  elo: 1542,
  player: runner,
  faction: "Criminal",
  influence: 2,
  cardType: "program",
  subTypes: ["Icebreaker", "Killer"],
  memoryCost: 1,
  installCost: 5,
  strength: 2,
  strengthBoost: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return this.strengthBoost;
      return 0; //no modification to strength
    },
  },
  //If you made a successful run this turn, this program costs 2[c] less to install.
  madeSuccessfulRunThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.madeSuccessfulRunThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.madeSuccessfulRunThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  runSuccessful: {
    Resolve: function () {
      this.madeSuccessfulRunThisTurn = true;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  modifyInstallCost: {
    Resolve: function (card) {
      if (card == this) {
        if (CheckInstalled(card)) return 0; //already installed...
        if (this.madeSuccessfulRunThisTurn) return -2; //2 less to install
      }
      return 0; //no modification to cost
    },
    automatic: true,
    availableWhenInactive: true,
  },
  //Interface -> 1[c]: Break 1 sentry subroutine.
  //2[c]: +3 strength.
  abilities: [
    {
      text: "Break 1 sentry subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Sentry")) return [];
        if (!CheckCredits(runner, 1, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
          },
          this
        );
      },
    },
    {
      text: "+3 strength.",
      Enumerate: function () {
        if (!CheckEncounter()) return []; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
        if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
        if (!CheckUnbrokenSubroutines()) return []; //as above
        if (!CheckSubType(attackedServer.ice[approachIce], "Sentry")) return []; //as above
        if (!CheckCredits(runner, 2, "using", this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          2,
          "using",
          this,
          function () {
            BoostStrength(this, 3);
          },
          this
        );
      },
    },
  ],
  encounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    result = result.concat(
        rc.ImplementIcebreaker(
          point,
          this,
          cardStrength,
          iceAI,
          iceStrength,
          ["Sentry"],
          2,
          3,
          1,
          1,
          creditsLeft
        )
    ); //cost to str, amt to str, cost to brk, amt to brk
	return result;
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't install if this is last click (unless discounted)
	if (runner.clickTracker < 2 && !this.madeSuccessfulRunThisTurn) return -1; //don't install
    return 0; //do install
  },
};
cardSet[30016] = {
  title: "Marjanah",
  imageFile: "30016.png",
  elo: 1448,
  player: runner,
  faction: "Criminal",
  influence: 1,
  cardType: "program",
  subTypes: ["Icebreaker", "Fracter"],
  memoryCost: 1,
  installCost: 0,
  strength: 1,
  strengthBoost: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return this.strengthBoost;
      return 0; //no modification to strength
    },
  },
  //If you made a successful run this turn...
  madeSuccessfulRunThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.madeSuccessfulRunThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  runSuccessful: {
    Resolve: function () {
      this.madeSuccessfulRunThisTurn = true;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  //Interface > 2[c]: Break 1 barrier subroutine. If you made a successful run this turn, this ability costs 1[c] less to use.
  abilities: [
    {
      text: "Break 1 barrier subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Barrier"))
          return [];
        var cost = 2;
        if (this.madeSuccessfulRunThisTurn) cost = 1;
        if (!CheckCredits(runner, cost, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        var cost = 2;
        if (this.madeSuccessfulRunThisTurn) cost = 1;
        SpendCredits(
          runner,
          cost,
          "using",
          this,
          function () {
            Break(params.subroutine);
          },
          this
        );
      },
    },
    //1[c]: +1 strength.
    {
      text: "+1 strength.",
      Enumerate: function () {
        if (!CheckEncounter()) return []; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
        if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
        if (!CheckUnbrokenSubroutines()) return []; //as above
        if (!CheckSubType(attackedServer.ice[approachIce], "Barrier"))
          return []; //as above
        if (!CheckCredits(runner, 1, "using", this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            BoostStrength(this, 1);
          },
          this
        );
      },
    },
  ],
  encounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    var marcost = 2;
    if (this.madeSuccessfulRunThisTurn) marcost = 1;
    result = result.concat(
        rc.ImplementIcebreaker(
          point,
          this,
          cardStrength,
          iceAI,
          iceStrength,
          ["Barrier"],
          1,
          1,
          marcost,
          1,
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
    return 0; //do install
  },
};
cardSet[30017] = {
  title: "Tranquilizer",
  imageFile: "30017.png",
  elo: 1638,
  player: runner,
  faction: "Criminal",
  influence: 3,
  cardType: "program",
  subTypes: ["Virus"],
  installCost: 2,
  memoryCost: 1,
  //Install only on a piece of ice.
  installOnlyOn: function (card) {
    if (!CheckCardType(card, ["ice"])) return false;
    return true;
  },
  //When you install this program and when your turn begins, place 1 virus counter on this program.
  //Then, if there are 3 or more hosted virus counters, derez host ice.
  SharedResolve: function () {
    AddCounters(this, "virus", 1);
    if (CheckCounters(this, "virus", 3)) Derez(this.host);
  },
  cardInstalled: {
    Resolve: function (card) {
      if (card == this) this.SharedResolve();
    },
  },
  runnerTurnBegin: {
    Resolve: function () {
      this.SharedResolve();
    },
    automatic: true, //for usability, this is not strict implementation
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	  //only target ice with 4 or greater rez cost that don't already have a special breaker hosted
	  var htsi = runner.AI._highestThreatScoreIce([this].concat(runner.AI._iceHostingSpecialBreakers()),4);
	  if (htsi)  {
		//find it in the choices list
		for (var i = 0; i < choices.length; i++) {
			if (htsi == choices[i].host) return i;
		}
	  }
	  return -1; //don't install
  },
  //acts like an icebreaker but doesn't have that subtype (or can be used on any subtype of ice)
  AISpecialBreaker:true,
  AIMatchingBreakerInstalled: function (iceCard) {
	//returns a matching breaker installed, or null
	if (iceCard == this.host) return this;
	//I know Tranquilizer isn't technically a breaker but we'll treat it like one
	//so we don't keep installing other stuff to get past it
	return null;
  },
  AIOkToTrash: function() {
	  //ok to trash if it has lost its abilities
	  if (this.host) {
		  if (this.host.AIDisablesHostedPrograms) return true; //do trash
	  }
	  return false; //don't trash
  },
};
cardSet[30018] = {
  title: "Red Team",
  imageFile: "30018.png",
  elo: 1517,
  player: runner,
  faction: "Criminal",
  influence: 2,
  cardType: "resource",
  subTypes: ["Job"],
  installCost: 5,
  runningWithThis: false,
  runHQ: false,
  runRnD: false,
  runArchives: false,
  //When you install this resource, load 12[c] onto it. When it is empty, trash it.
  cardInstalled: {
    Resolve: function (card) {
      if (card == this) LoadCredits(this, 12);
    },
  },
  //[click]: Run a central server you have not run this turn. If successful, take 3[c] from this resource.
  runnerTurnBegin: {
    Resolve: function () {
      this.runHQ = false;
      this.runRnD = false;
      this.runArchives = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  runSuccessful: {
	Enumerate: function() {
		if (this.runningWithThis) return [{}];
		return [];
	},
    Resolve: function (params) {
        if (CheckCounters(this, "credits", 3)) TakeCredits(runner, this, 3); //won't happen with less than 3 because it doesn't say 'take *up to* ...'
        if (!CheckCounters(this, "credits", 1)) Trash(this);
    }
  },
  //Rulings: "Red Team cares about the server the Runner declared to be the attacked server at the beginning of the run."
  runBegins: {
    Resolve: function (server) {
      if (server == corp.HQ) this.runHQ = true;
      if (server == corp.RnD) this.runRnD = true;
      if (server == corp.archives) this.runArchives = true;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  runEnds: {
    Resolve: function () {
      this.runningWithThis = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  abilities: [
    {
      text: "Run a central server you have not run this turn.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        var ret = [];
        if (!this.runHQ) ret.push({ server: corp.HQ, label: "HQ" });
        if (!this.runRnD) ret.push({ server: corp.RnD, label: "R&D" });
        if (!this.runArchives)
          ret.push({ server: corp.archives, label: "Archives" });
        return ret;
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        this.runningWithThis = true;
        MakeRun(params.server);
      },
    },
  ],
  //install before run if this server is central and hasn't been run this turn
  AIInstallBeforeRun: function(server,potential,useRunEvent,runCreditCost,runClickCost) {
	  //require successful run
	  if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0;
	  if (typeof server.cards !== "undefined") {
		var alreadyRunThisTurn = false;
		if (server == corp.HQ)
		  alreadyRunThisTurn = this.runHQ;
		else if (server == corp.RnD)
		  alreadyRunThisTurn = this.runRnD;
		else if (server == corp.archives)
		  alreadyRunThisTurn = this.runArchives;
		if (!alreadyRunThisTurn) return 1; //yes
	  }
	  return 0; //no
  },
  AIEconomyInstall: function() {
	  return 1; //priority 1 (yes install but there are better options)
  },
  AIRunAbilityExtraPotential: function(server,potential) {
	  //require successful run
	  if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0;
	  //might get a little credit from this (the 0.5 is arbitrary)
	  if (!this.runHQ && server == corp.HQ)
		return 0.5;
	  else if (!this.runRnD && server == corp.RnD)
		return 0.5;
	  else if (!this.runArchives && server == corp.archives)
		return 0.5;
	  return 0; //no benefit (don't use)
  },
  AIBreachNotRequired: true, //the benefit is gained with or without breach
};
cardSet[30019] = {
  title: "Tāo Salonga: Telepresence Magician",
  imageFile: "30019.png",
  elo: 1653,
  player: runner,
  faction: "Shaper",
  link: 0,
  cardType: "identity",
  deckSize: 40,
  influenceLimit: 15,
  subTypes: ["Natural"],
  SharedEnumerate: function () {
    var choices = ChoicesInstalledCards(corp, function (card) {
      return CheckCardType(card, ["ice"]);
    });
    if (choices.length < 2) return [];
    var continueChoice = {
      id: choices.length,
      label: "Continue without swapping",
      button: "Continue without swapping",
    };
    //**AI code (in this case, implemented by setting and returning the preferred option)
    if (runner.AI != null) {
      var goodIce = null;
      //best ice to move has high printed rezcost and is in a high potential server
      var bestScore = 0;
      var bestIndex = -1;
      for (var i = 0; i < choices.length; i++) {
        var thisScore = 0;
        var iceCard = choices[i].card;
        if (iceCard.rezzed) {
          //no point swapping unrezzed ice with unrezzed ice
		  thisScore = runner.AI._iceComparisonScore(iceCard);
          if (thisScore > bestScore) {
            bestScore = thisScore;
            bestIndex = i;
            goodIce = choices[i].card;
          }
        }
      }
      if (goodIce) {
        //don't swap with any ice from that server
        var srcServer = GetServer(goodIce);
        for (var i = choices.length - 1; i > -1; i--) {
          if (GetServer(choices[i].card) == srcServer) choices.splice(i, 1);
        }
        //swap with any unrezzed ice in any other server (could maybe include low-rez-cost ice too?)
        var poorIce = null;
        for (var i = 0; i < choices.length; i++) {
          if (!choices[i].card.rezzed) {
            poorIce = choices[i].card;
            break;
          }
        }
        //console.log("Good: "+GetTitle(goodIce,true)+" , Poor: "+GetTitle(poorIce,true));
        if (poorIce && goodIce) return [{ cards: [poorIce, goodIce] }];
      }
      return continueChoice;
    }
    //not AI? set up for human choice (multi-choice)
    for (var i = 0; i < choices.length; i++) {
      choices[i].cards = [null, null];
    } //set up a multiple-select for two cards
    choices.push(continueChoice); // include a button to continue without swapping
    return choices;
  },
  SharedResolve: function (iceToSwap) {
    //an array of two card objects
    if (typeof iceToSwap !== "undefined") {
      var firstServer = GetServer(iceToSwap[0]);
      var secondServer = GetServer(iceToSwap[1]);
	  var firstIndex = firstServer.ice.indexOf(iceToSwap[0]);
	  var secondIndex = secondServer.ice.indexOf(iceToSwap[1]);
	  //store server info to make sure servers aren't destroyed here (see below)
      var serverIndex = corp.remoteServers.indexOf(firstServer);
	  //move the first card
	  MoveCard(iceToSwap[0], secondServer.ice, secondIndex);
      //if this move destroyed a remote server, it shouldn't have (see CR1.5 8.5.9)
      if (serverIndex > -1) {
        if (GetServerByArray(firstServer.ice) == null)
          corp.remoteServers.splice(serverIndex, 0, firstServer);
      }
	  //move the second card
	  MoveCard(iceToSwap[1], firstServer.ice, firstIndex);
      if (firstServer == secondServer)
        Log(
          GetTitle(iceToSwap[0], true) +
            " and " +
            GetTitle(iceToSwap[1], true) +
            " in " +
            ServerName(firstServer) +
            " swapped"
        );
      else
        Log(
          GetTitle(iceToSwap[0], true) +
            " in " +
            ServerName(firstServer) +
            " swapped with " +
            GetTitle(iceToSwap[1], true) +
            " in " +
            ServerName(secondServer)
        );
    }
  },
  scored: {
    Enumerate() {
      return this.SharedEnumerate();
    },
    Resolve: function (params) {
      this.SharedResolve(params.cards);
    },
    text: "Tāo Salonga: Swap 2 installed pieces of ice",
  },
  stolen: {
    Enumerate() {
      return this.SharedEnumerate();
    },
    Resolve: function (params) {
      this.SharedResolve(params.cards);
    },
    text: "Tāo Salonga: Swap 2 installed pieces of ice",
  },
};
cardSet[30020] = {
  title: "Creative Commission",
  imageFile: "30020.png",
  elo: 1767,
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "event",
  playCost: 1,
  //Gain 5[c]. If you have any [click] remaining, lose [click].
  Resolve: function (params) {
    GainCredits(runner, 5);
    LoseClicks(runner, 1);
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	//keep if need money
	if (Credits(runner) < 5) return true;
	return false;
  },
  AIWastefulToPlay: function () {
    if (runner.clickTracker == 2) {
		return true;
	}
	return false;  
  },
};
cardSet[30021] = {
  title: "VRcation",
  imageFile: "30021.png",
  elo: 1660,
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "event",
  playCost: 1,
  //Draw 4 cards. If you have any [click] remaining, lose [click].
  Resolve: function (params) {
    Draw(runner, 4, function() {
	  LoseClicks(runner, 1);
	},this);
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
      //keep if need card draw
      if (runner.grip.length < 3) return true;
	  return false;
  },
  AIWouldPlay: function() {
	//don't burn a click
	if (runner.clickTracker == 2) return false;
	//prevent wild overdraw (and try to take into account the one this will burn)
    if (runner.AI._currentOverDraw() + 2 < runner.AI._maxOverDraw()) return true;
	return false;
  },
  AIPlayToDraw: 3, //priority 3 (can't get much better draw than this)
};
cardSet[30022] = {
  title: "DZMZ Optimizer",
  imageFile: "30022.png",
  elo: 1570,
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "hardware",
  installCost: 2,
  memoryUnits: 1,
  //The first program you install each turn costs 1[c] less to install
  installedProgramThisTurn: false,
  modifyInstallCost: {
    Resolve: function (card) {
      if (this.installedProgramThisTurn) return 0;
      if (CheckInstalled(card)) return 0; //already installed...
      if (CheckCardType(card, ["program"])) return -1;
      return 0; //no modification to cost
    },
  },
  cardInstalled: {
    Resolve: function (card) {
      if (this.installedProgramThisTurn) return;
      if (CheckCardType(card, ["program"]))
        this.installedProgramThisTurn = true;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  runnerTurnBegin: {
    Resolve: function () {
      this.installedProgramThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.installedProgramThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if available mu is 1 or less
	  if (spareMU < 2) return true;
	  return false;
  },
  AIEconomyInstall: function() {
	  return 1; //priority 1 (yes install but there are better options)
  },
};
cardSet[30023] = {
  title: "Pantograph",
  imageFile: "30023.png",
  elo: 1572,
  player: runner,
  faction: "Shaper",
  influence: 3,
  cardType: "hardware",
  subTypes: ["Console"],
  installCost: 2,
  unique: true,
  memoryUnits: 1,
  //Whenever an agenda is scored or stolen, gain 1[c].
  //Then, you may install 1 card from your grip.
  SharedPhase: {
    //player: runner, //this line is commented because it causes a "too much recursion" error
    title: "Pantograph",
    identifier: "Pantograph Install",
    Enumerate: {
      install: function () {
        var choices = ChoicesHandInstall(runner);
        choices.push({
          card: null,
          label: "Continue without install",
          button: "Continue without install",
        });
        //**AI code (in this case, implemented by setting and returning the preferred option)
        if (runner.AI != null) {
          runner.AI.cardsWorthKeeping = runner.AI._cardsInHandWorthKeeping();
          for (
            var i = 0;
            i < choices.length - 1;
            i++ //choices.length-1 because the last one is the null option
          ) {
            //if the card is worthkeeping, choose the first acceptable option
            //could be more complex about this, this method doesn't choose the best card or best option, and does't install non-worthkeepings
            var choice = choices[i];
            var card = choice.card;
            if (runner.AI.cardsWorthKeeping.includes(card)) {
              if (typeof card.AIPreferredInstallChoice == "function") {
                if (card.AIPreferredInstallChoice([choice]) > -1)
                  return [choice];
              } else return [choice]; //no reasons not to install it
            }
          }
          //no good options? return the null option
          return [choices[choices.length - 1]];
        }
        //not AI? return choices list for human decisionmaking
        return choices;
      },
    },
    Resolve: {
      install: function (params) {
        if (params.card !== null)
          Install(
            params.card,
            params.host,
            false,
            null,
            true,
            function () {
              IncrementPhase(true);
            },
            this
          );
        else IncrementPhase(true);
      },
    },
  },
  SharedResolve: function () {
    GainCredits(runner, 1);
    this.SharedPhase.player = runner;
    this.SharedPhase.next = currentPhase;
    ChangePhase(this.SharedPhase);
  },
  scored: {
    Resolve: function (params) {
      this.SharedResolve();
    },
    text: "Pantograph: Gain 1[c], you may install 1 card",
  },
  stolen: {
    Resolve: function (params) {
      this.SharedResolve();
    },
    text: "Pantograph: Gain 1[c], you may install 1 card",
  },
  AIEconomyInstall: function() {
	  return 1; //priority 1 (yes install but there are better options)
  },
};
cardSet[30024] = {
  title: "Conduit",
  imageFile: "30024.png",
  elo: 1767,
  player: runner,
  faction: "Shaper",
  influence: 4,
  cardType: "program",
  subTypes: ["Virus"],
  memoryCost: 1,
  installCost: 4,
  runningWithThis: false,
  runWasSuccessful: false,
  runBegins: {
    Resolve: function (server) {
      this.runWasSuccessful = false;
    },
    automatic: true,
  },
  runSuccessful: {
    Resolve: function () {
      this.runWasSuccessful = true;
    },
    automatic: true,
  },
  runUnsuccessful: {
    Resolve: function () {
      this.runWasSuccessful = false;
      this.runningWithThis = false;
    },
    automatic: true,
  },
  //If successful, access X additional cards when you breach R&D.
  //X is equal to the number of hosted virus counters.
  breachServer: {
	//NOTE: breachServer may be called multiple times (e.g. when determining new candidates)  
    Resolve: function () {
      var ret = 0; //by default, no additional cards
      if (this.runningWithThis && this.runWasSuccessful && attackedServer == corp.RnD) {
        ret += Counters(this, "virus"); //access X additional cards
      }
      return ret;
    },
  },
  //Whenever a successful run on R&D ends, you may place 1 virus counter on this program
  runEnds: {
	Enumerate: function() {
		this.runningWithThis = false;
		if (attackedServer == corp.RnD && this.runWasSuccessful) return [{}];
		return [];
	},
    Resolve: function () {
        //"may"
        var choices = BinaryDecision(
          runner,
          "Place 1 virus counter",
          "Continue",
          "Conduit",
          this,
          function () {
            AddCounters(this, "virus", 1);
          }
        );
        //**AI code
        if (runner.AI != null) {
          runner.AI._log("I know this one");
          var choice = choices[0]; //always place a virus counter (why wouldn't you?)
          runner.AI.preferred = { title: "Conduit", option: choice }; //title must match currentPhase.title for AI to fire
        }
    },
  },
  //[click]: Run R&D.
  abilities: [
    {
      text: "Run R&D.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        this.runningWithThis = true;
        MakeRun(corp.RnD);
      },
    },
  ],
  //install before run if the server is R&D and Conduit is in worthkeeping
  AIInstallBeforeRun: function(server,potential,useRunEvent,runCreditCost,runClickCost) {
	if (server == corp.RnD) {
		if (runner.AI.cardsWorthKeeping.includes(this)) return 1; //yes
	}
	return 0; //no
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if not wasteful (i.e. there is not already a Conduit installed) and a run into R&D is possible
	  if (!this.AIWastefulToInstall()) {
		if (runner.AI._getCachedCost(corp.RnD) != Infinity) return true;
	  }
	  return false;
  },
  AIWastefulToInstall: function() {
	  for (var j = 0; j < runner.rig.programs.length; j++) {
		if (runner.rig.programs[j].title == "Conduit") {
		  return true; //already a Conduit installed
		}
	  }
	  return false;
  },
  AIRunAbilityExtraPotential: function(server,potential) {
	  if (server == corp.RnD) {
		//require successful run
		if (runner.AI._rootKnownToContainCopyOfCard(corp.RnD, "Crisium Grid")) return 0; // don't use
		//extra potential the deeper you can dig (except cards already known)
		var conduitDepth = Counters(this, "virus") + 1;
		//ignore top card as it is not 'bonus'
		var conduitBonusCards =
		  runner.AI._countNewCardsThatWouldBeAccessedInRnD(conduitDepth,[corp.RnD.cards[corp.RnD.cards.length-1]]);
		if (conduitBonusCards > 0) {
		  //only use it if it gives a benefit (it still gains counters from runs with other cards either way)
		  return conduitBonusCards - 1;
		}
	  }
	  return 0; //don't use
  },
  AIRunExtraPotential: function(server,potential) {
	  if (server == corp.RnD) {
	    //passive bonus to R&D potential due to gaining virus counters
		var conduitDepth = Counters(this, "virus") + 1;
	    if (conduitDepth < corp.RnD.cards.length) {
		  return 0.5; //arbitrary, for being able to gain virus counters (ignore if dig reaching the bottom of R&D)
	    }
	  }
	  return 0; //no bonus
  },
};
cardSet[30025] = {
  title: "Echelon",
  imageFile: "30025.png",
  elo: 1480,
  player: runner,
  faction: "Shaper",
  influence: 1,
  cardType: "program",
  subTypes: ["Icebreaker", "Killer"],
  memoryCost: 1,
  installCost: 3,
  strength: 0,
  strengthBoost: 0,
  //This program gets +1 strength for each installed icebreaker (including this one).
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) {
        var ret = this.strengthBoost;
        //loop through Runner's installed cards, +1ing for each one with icebreaker subtype
        var cardstocheck = InstalledCards(runner);
        for (var i = 0; i < cardstocheck.length; i++) {
          if (CheckSubType(cardstocheck[i], "Icebreaker")) ret++;
        }
        return ret;
      }
      return 0; //no modification to strength
    },
  },
  //Interface -> 1[c]: Break 1 sentry subroutine.
  abilities: [
    {
      text: "Break 1 code gate subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Sentry")) return [];
        if (!CheckCredits(runner, 1, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
          },
          this
        );
      },
    },
    //3[c]: +2 strength
    {
      text: "+1 strength for each installed icebreaker (including this one).",
      Enumerate: function () {
        if (!CheckEncounter()) return []; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
        if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
        if (!CheckUnbrokenSubroutines()) return []; //as above
        if (!CheckSubType(attackedServer.ice[approachIce], "Sentry")) return []; //as above
        if (!CheckCredits(runner, 3, "using", this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          3,
          "using",
          this,
          function () {
            BoostStrength(this, 2);
          },
          this
        );
      },
    },
  ],
  encounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    result = result.concat(
        rc.ImplementIcebreaker(
          point,
          this,
          cardStrength,
          iceAI,
          iceStrength,
          ["Sentry"],
          3,
          2,
          1,
          1,
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
    return 0; //do install
  },
};
cardSet[30026] = {
  title: "Unity",
  imageFile: "30026.png",
  elo: 1739,
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "program",
  subTypes: ["Icebreaker", "Decoder"],
  memoryCost: 1,
  installCost: 3,
  strength: 1,
  strengthBoost: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return this.strengthBoost;
      return 0; //no modification to strength
    },
  },
  //Interface -> 1[c]: Break 1 code gate subroutine.
  //1[c]: +1 strength for each installed icebreaker (including this one).
  abilities: [
    {
      text: "Break 1 code gate subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckSubType(attackedServer.ice[approachIce], "Code Gate"))
          return [];
        if (!CheckCredits(runner, 1, "using", this)) return [];
        if (!CheckStrength(this)) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
          },
          this
        );
      },
    },
    {
      text: "+1 strength for each installed icebreaker (including this one).",
      Enumerate: function () {
        if (!CheckEncounter()) return []; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
        if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
        if (!CheckUnbrokenSubroutines()) return []; //as above
        if (!CheckSubType(attackedServer.ice[approachIce], "Code Gate"))
          return []; //as above
        if (!CheckCredits(runner, 1, "using", this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        //loop through Runner's installed cards, counting ones with icebreaker subtype
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            var cardstocheck = InstalledCards(runner);
            var amountToBoost = 0;
            for (var i = 0; i < cardstocheck.length; i++) {
              if (CheckSubType(cardstocheck[i], "Icebreaker")) amountToBoost++;
            }
            BoostStrength(this, amountToBoost);
          },
          this
        );
      },
    },
  ],
  encounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    var strup = rc.precalculated.runnerInstalledIcebreakersLength;
    result = result.concat(
        rc.ImplementIcebreaker(
          point,
          this,
          cardStrength,
          iceAI,
          iceStrength,
          ["Code Gate"],
          1,
          strup,
          1,
          1,
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
    return 0; //do install
  },
};
cardSet[30027] = {
  title: "Telework Contract",
  imageFile: "30027.png",
  elo: 1624,
  player: runner,
  faction: "Shaper",
  influence: 2,
  cardType: "resource",
  subTypes: ["Job"],
  installCost: 1,
  usedThisTurn: false, //NOTE: "Use this ability only once per turn" conditions are once *per copy* per turn.
  //When you install this resource, load 9[c] onto it. When it is empty, trash it.
  cardInstalled: {
    Resolve: function (card) {
      if (card == this) LoadCredits(this, 9);
    },
  },
  runnerTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  //[click]: Take 3[c] from this resource. Use this ability only once per turn.
  abilities: [
    {
      text: "Take 3[c] from this resource.",
      Enumerate: function () {
        if (this.usedThisTurn) return []; //Use this ability only once per turn.
        if (!CheckActionClicks(runner, 1)) return [];
        if (!CheckCounters(this, "credits", 3)) return []; //because it doesn't say 'take *up to* ...'
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        TakeCredits(runner, this, 3); //removes from card, adds to credit pool
        this.usedThisTurn = true;
        if (!CheckCounters(this, "credits", 1)) {
          Trash(this, true);
        }
      },
    },
  ],
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if need money
	  if (Credits(runner) < 5) return true;
	  return false;
  },
  AIEconomyInstall: function() {
	  return 2; //priority 2 (moderate)
  },
  AIEconomyTrigger: 2, //priority 2 (moderate)
};
cardSet[30028] = {
  title: "Jailbreak",
  imageFile: "30028.png",
  elo: 1657,
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 0,
  //Run HQ or R&D. If successful, draw 1 card and when you breach the attacked server, access 1 additional card.
  Enumerate: function () {
    var ret = [];
    ret.push({ server: corp.HQ, label: "HQ" });
    ret.push({ server: corp.RnD, label: "R&D" });
    return ret;
  },
  Resolve: function (params) {
    MakeRun(params.server);
  },
  runWasSuccessful: false,
  runBegins: {
    Resolve: function (server) {
      this.runWasSuccessful = false;
    },
    automatic: true,
  },
  runSuccessful: {
    Resolve: function () {
      this.runWasSuccessful = true;
      Draw(runner, 1);
    },
  },
  breachServer: {
	//NOTE: breachServer may be called multiple times (e.g. when determining new candidates)
    Resolve: function () {
	  if (this.runWasSuccessful) return 1;
      return 0;
    },
  },
  //indicate bonus to accesses (when active)
  AIAdditionalAccess: function(server) {
      if (server != corp.HQ && server != corp.RnD) return 0;
	  //require successful run
	  if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0;
      return 1;
  },
  //don't define AIWouldPlay for run events, instead use AIRunEventExtraPotential(server,potential) and return float (0 to not play)
  AIRunEventExtraPotential: function(server,potential) {
	  //use Jailbreak only for HQ and R&D with no unrezzed ice
	  if (server == corp.HQ || server == corp.RnD) {
	    //require successful run
	    if (runner.AI._rootKnownToContainCopyOfCard(server, "Crisium Grid")) return 0; //don't use
		var unrezzedIceThisServer = 0;
		for (var i = 0; i < server.ice.length; i++) {
		  if (!server.ice[i].rezzed) unrezzedIceThisServer++;
		}
		if (unrezzedIceThisServer == 0) {
			//only play Jailbreak if the extra accesses are worthwhile
			if (server == corp.HQ) {
				return 0.5*runner.AI._additionalHQAccessValue(this);  //0.5 is consistent with other implementations of potential from extra access
			}
			else if (server == corp.RnD) {
				return 0.5*runner.AI._countNewCardsThatWouldBeAccessedInRnD(1+1); //0.5 is consistent with other implementations of potential from extra access
			}
			return 0;
		}
	  }
	  return 0; //no benefit (don't play)
  },
};
cardSet[30029] = {
  title: "Overclock",
  imageFile: "30029.png",
  elo: 1683,
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "event",
  subTypes: ["Run"],
  playCost: 1,
  //Place 5[c] on this event, then run any server.
  Enumerate: function () {
    return ChoicesExistingServers();
  },
  Resolve: function (params) {
    PlaceCredits(this, 5);
    MakeRun(params.server);
  },
  //You can spend hosted credits during that run.
  canUseCredits: function (doing, card) {
    return true;
  },
  //don't define AIWouldPlay for run events, instead use AIRunEventExtraPotential(server,potential) and return float (0 to not play)
  AIRunEventExtraPotential: function(server,potential) {
	  //save Overclock for high value targets
	  if (potential > 1.5) return 0.01; //greater than zero means 'yes' but we don't want to significantly change the potential
	  return 0; //no benefit (don't play)
  },
  AIRunEventExtraCredits: 5, //the runner AI code will subtract the 1 play cost so effectively 4 net bonus  
};
cardSet[30030] = {
  title: "Sure Gamble",
  imageFile: "30030.png",
  elo: 1924,
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "event",
  playCost: 5,
  Resolve: function (params) {
    GainCredits(runner, 9);
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //we love Sure Gamble, always keep it
	  return true;
  },
};
cardSet[30031] = {
  title: "T400 Memory Diamond",
  imageFile: "30031.png",
  elo: 1394,
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "hardware",
  subTypes: ["Chip"],
  installCost: 2,
  memoryUnits: 1,
  //You get +1 maximum hand size.
  modifyMaxHandSize: {
    Resolve: function (player) {
      if (player == runner) return 1; //+1
      return 0; //no modification to maximum hand size
    },
  },
  AIWorthKeeping: function (installedRunnerCards, spareMU) {
	  //keep if available mu is 1 or less
	  if (spareMU < 2) return true;
	  return false;
  },
};
cardSet[30032] = {
  title: "Mayfly",
  imageFile: "30032.png",
  elo: 1665,
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "program",
  subTypes: ["Icebreaker", "AI"],
  memoryCost: 2,
  installCost: 1,
  strength: 1,
  conditionsMet: false, //when this is true, trash at end of run
  strengthBoost: 0,
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) return this.strengthBoost;
      return 0; //no modification to strength
    },
  },
  //Interface -> 1[c]: Break 1 subroutine. When this run ends, trash this program.
  //1[c]: +1 strength.
  abilities: [
    {
      text: "Break 1 subroutine.",
      Enumerate: function () {
        if (!CheckEncounter()) return [];
        if (!CheckCredits(runner, 1, "using", this)) return [];
        if (!CheckStrength(this)) return [];
		if (GetApproachEncounterIce().cannotBreakUsingAIPrograms) return [];
        return ChoicesEncounteredSubroutines();
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            Break(params.subroutine);
            this.conditionsMet = true; //When this run ends, trash this program.
          },
          this
        );
      },
    },
    {
      text: "+1 strength.",
      Enumerate: function () {
        if (!CheckEncounter()) return []; //technically you can +1 strength outside encounters but I'm putting this here for interface usability
        if (CheckStrength(this)) return []; //technically you can over-strength but I'm putting this here for interface usability
		if (GetApproachEncounterIce().cannotBreakUsingAIPrograms) return []; //for usability not legality
        if (!CheckUnbrokenSubroutines()) return []; //as above
        if (!CheckCredits(runner, 1, "using", this)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendCredits(
          runner,
          1,
          "using",
          this,
          function () {
            BoostStrength(this, 1);
          },
          this
        );
      },
    },
  ],
  encounterEnds: {
    Resolve: function () {
      this.strengthBoost = 0;
    },
    automatic: true,
  },
  runEnds: {
    Enumerate: function () {
      if (this.conditionsMet) return [{}];
      return [];
    },
    Resolve: function (params) {
      Trash(this, true);
    },
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	if (iceAI.ice.cannotBreakUsingAIPrograms) return result;
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    //unless have a spare, only use Mayfly for worthwhile targets (the 1.5 is arbitrary)
    var anotherInGrip = false;
    for (var i = 0; i < runner.grip.length; i++) {
        if (runner.grip[i].title == "Mayfly") {
          anotherInGrip = true;
          break;
        }
    }
	//the !runner.AI check is in case the corp is doing the calculation
    if (!runner.AI || runner.AI._getCachedPotential(server) > 1.5 || anotherInGrip) {
        result = result.concat(
          rc.ImplementIcebreaker(
            point,
            this,
            cardStrength,
            iceAI,
            iceStrength,
            [],
            1,
            1,
            1,
            1,
            creditsLeft
          )
        ); //cost to str, amt to str, cost to brk, amt to brk
	}
	return result;
  },
  AIWastefulToInstall: function() {
	  for (var j = 0; j < runner.rig.programs.length; j++) {
		if (runner.rig.programs[j].title == "Mayfly") {
		  return true; //already a Mayfly installed
		}
	  }
	  return false;
  },
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't install if this is last click
	if (runner.clickTracker < 2) return -1; //don't install
    return 0; //do install
  },
};
cardSet[30033] = {
  title: "Smartware Distributor",
  imageFile: "30033.png",
  elo: 1355,
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "resource",
  subTypes: ["Connection"],
  installCost: 0,
  //[click]: Place 3[c] on this resource.
  abilities: [
    {
      text: "Place 3[c] on this resource.",
      Enumerate: function () {
        if (!CheckActionClicks(runner, 1)) return [];
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        PlaceCredits(this, 3);
      },
    },
  ],
  //When your turn begins, take 1[c] from this resource.
  runnerTurnBegin: {
    /*
		Enumerate: function() {
			if (!CheckCounters(this,"credits",1)) return [];
			return [{}];
		},
		*/
    Resolve: function (params) {
      if (CheckCounters(this, "credits", 1)) TakeCredits(runner, this, 1); //removes from card, adds to credit pool
    },
    automatic: true, //for usability, this is not strict implementation (if you make it non-automatic then move the check out of Resolve and uncomment Enumerate)
  },
  AIWouldTrigger: function () {
    var counters = Counters(this, "credits");
    //don't trigger if there are already 3 or more credits
    if (counters > 2) return false;
    //don't trigger if there is another smartware installed that has less counters
    for (var i = 0; i < runner.rig.resources.length; i++) {
      if (runner.rig.resources[i] !== this) {
        if (runner.rig.resources[i].title == "Smartware Distributor") {
          if (Counters(runner.rig.resources[i], "credits") < counters)
            return false;
        }
      }
    }
    return true;
  },
  AIEconomyInstall: function() {
	  return 1; //priority 1 (yes install but there are better options)
  },
  AIEconomyTrigger: 1, //priority 1 (yes trigger but there are better options)
  AIPreferredInstallChoice: function (
    choices //outputs the preferred index from the provided choices list (return -1 to not install)
  ) {
	//don't install if this is last click
	if (runner.clickTracker < 2) return -1; //don't install
    return 0; //do install
  },
};
cardSet[30034] = {
  title: "Verbal Plasticity",
  imageFile: "30034.png",
  elo: 1451,
  player: runner,
  faction: "Neutral",
  influence: 0,
  cardType: "resource",
  subTypes: ["Genetics"],
  installCost: 3,
  unique: true,
  //The first time each turn you take the basic action to draw 1 card, instead draw 2 cards.
  usedBasicActionDrawThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.usedBasicActionDrawThisTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  modifyBasicActionRunnerDraw: {
    Resolve: function (num) {
      var ret = 0; //by default, no modification to basic action draw amount
      if (!this.usedBasicActionDrawThisTurn && CheckActive(this) && num == 1)
        ret = 1; //+1 i.e. draw 2 cards
      this.usedBasicActionDrawThisTurn = true; //first this turn can pass even if card not active
      return ret;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  AIDrawInstall: function() {
	  return 1; //priority 1 (yes install but there are better options)
  },
};
cardSet[30035] = {
  title: "Haas-Bioroid: Precision Design",
  imageFile: "30035.png",
  elo: 1867,
  player: corp,
  faction: "Haas-Bioroid",
  cardType: "identity",
  deckSize: 40,
  influenceLimit: 15,
  subTypes: ["Megacorp"],
  //You get +1 maximum hand size.
  modifyMaxHandSize: {
    Resolve: function (player) {
      if (player == corp) return 1; //+1
      return 0; //no modification to maximum hand size
    },
  },
  //Whenever you score an agenda, you may add 1 card from Archives to HQ
  scored: {
    Enumerate: function () {
      var ret = ChoicesArrayCards(corp.archives.cards);
	  //**AI code
	  if (corp.AI != null) {
		  var bestRecur = corp.AI._bestRecurToHQOption(ret,null,true); //no server under threat, use now if possible
		  if (bestRecur) ret = [bestRecur];
	  }
      if (ret.length < 1) return [];
      ret.push({ card: null, label: "Continue", button: "Continue" });
      return ret;
    },
    Resolve: function (params) {
      if (params.card !== null) {
        Log(GetTitle(params.card, true) + " added to HQ from Archives");
        MoveCard(params.card, corp.HQ.cards);
      }
    },
    text: "You may add 1 card from Archives to HQ",
  },
};
cardSet[30036] = {
  title: "Luminal Transubstantiation",
  imageFile: "30036.png",
  elo: 1834,
  player: corp,
  faction: "Haas-Bioroid",
  cardType: "agenda",
  subTypes: ["Research"],
  agendaPoints: 2,
  advancementRequirement: 3,
  limitPerDeck: 1,
  //When you score this agenda, gain [click][click][click].
  scored: {
    Enumerate: function () {
      if (intended.score == this) return [{}];
      return [];
    },
    Resolve: function (params) {
      GainClicks(corp, 3);
      this.cannot.Resolve = function (str, card) {
        if (str == "score") return true; //cannot score
        return false; //nothing else forbidden
      };
      Log("Corp cannot score agendas for the remainder of this turn.");
    },
    text: "Gain [click][click][click]",
  },
  //You cannot score agendas for the remainder of the turn.
  cannot: {
    Resolve: function (str, card) {
      return false;
    }, //nothing forbidden
    availableWhenInactive: true,
  },
  runnerTurnBegin: {
    Resolve: function (params) {
      this.cannot.Resolve = function (str, card) {
        return false;
      }; //nothing forbidden
    },
    availableWhenInactive: true,
    automatic: true,
  },
};
cardSet[30037] = {
  title: "Nico Campaign",
  imageFile: "30037.png",
  elo: 1721,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 2,
  cardType: "asset",
  subTypes: ["Advertisement"],
  rezCost: 2,
  trashCost: 2,
  //When you rez this asset, load 9[c] onto it.
  cardRezzed: {
    Resolve: function (card) {
      if (card == this) LoadCredits(this, 9);
    },
  },
  //When your turn begins, take 3[c] from this asset.
  corpTurnBegin: {
	Enumerate: function() {
		if (!CheckCounters(this,"credits",3)) return []; //won't happen with less than 3 because it doesn't say 'take *up to* ...'
		return [{}];
	},
    Resolve: function (params) {
      TakeCredits(corp, this, 3); //removes from card, adds to credit pool
      if (!CheckCounters(this, "credits", 1)) {
        //When it is empty, trash it and draw 1 card.
        Trash(this); //in theory prevent could be allowed but why would you? Also it would mean this can no longer be automatic
        Draw(corp, 1);
      }
    },
  },
  RezUsability: function () {
    if (currentPhase.identifier == "Runner 2.2") return true;
    return false;
  },
};
cardSet[30038] = {
  title: "Ansel 1.0",
  imageFile: "30038.png",
  elo: 1699,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 3,
  cardType: "ice",
  rezCost: 6,
  strength: 4,
  subTypes: ["Sentry", "Bioroid", "Destroyer"],
  //subroutines:
  //Trash 1 installed Runner card.
  //You may install 1 card from HQ or Archives.
  //The Runner cannot steal or trash Corp cards for the remainder of this run.
  subroutines: [
    {
      text: "Trash 1 installed Runner card.",
      Resolve: function (params) {
        var choices = ChoicesInstalledCards(runner, CheckTrash);
        if (choices.length > 0) {
          var decisionCallback = function (params) {
            Trash(params.card, true); //true means can be prevented
          };
          DecisionPhase(
            corp,
            choices,
            decisionCallback,
            "Ansel 1.0",
            "Trash",
            this,
            "trash"
          );
        }
      },
      visual: { y: 89, h: 16 },
    },
    {
      text: "You may install 1 card from HQ or Archives.",
      Resolve: function () {
        var choicesA = [];
        var handOptions = ChoicesHandInstall(corp);
		var handChoice = {
            id: 0,
            label: "Install from HQ",
            button: "Install from HQ",
          };
        if (handOptions.length > 0) choicesA.push(handChoice);
        var archivesOptions = ChoicesArrayInstall(corp.archives.cards);
		var archivesChoice = {
            id: 1,
            label: "Install from Archives",
            button: "Install from Archives",
          };
        if (archivesOptions.length > 0) choicesA.push(archivesChoice);
        choicesA.push({ id: 2, label: "Continue", button: "Continue" });
        function decisionCallbackA(params) {
          if (params.id < 2) {
            //i.e. didn't continue
            var choicesB = handOptions;
            if (params.id == 1) {
              choicesB = archivesOptions;
              Log("Corp chose to install 1 card from Archives");
            } else Log("Corp chose to install 1 card from HQ");
            //choose the card to install
            function decisionCallbackB(params) {
              if (params.card !== null) Install(params.card, params.server);
            }
            DecisionPhase(
              corp,
              choicesB,
              decisionCallbackB,
              "Ansel 1.0",
              "Install",
              this,
              "install"
            );
          }
        }
        DecisionPhase(
          corp,
          choicesA,
          decisionCallbackA,
          "Ansel 1.0",
          "Ansel 1.0",
          this
        );
        //**AI code
        if (corp.AI != null) {
		  //find out what option is preferred (if any)
		  var choice = choicesA[choicesA.length-1]; //continue by default, if no desired options are found
		  //check archives first
		  var archivesBestOption = -1;
		  if (archivesOptions.length > 0) {
			archivesBestOption = corp.AI._bestInstallOption(archivesOptions,false); //don't inhibit
		  }
		  //if no desirable option, try HQ
		  var handBestOption = -1;
		  if (archivesBestOption < 0 && handOptions.length > 0) {
			  handBestOption = corp.AI._bestInstallOption(handOptions,true); //do inhibit
		  }
		  //if no desirable option, continue
		  if (archivesBestOption < 0 && handBestOption < 0) {
			
		  }
          //prefer archives if possible, then HQ (otherwise default is nothing, see above)
          if (archivesBestOption > -1) choice = archivesChoice;
		  else if (handBestOption > -1) choice = handChoice;
          corp.AI._log("I think "+choice.label+" would be best right now");
          corp.AI.preferred = { title: "Ansel 1.0", option: choice }; //title must match currentPhase.title for AI to fire
        }
      },
      visual: { y: 113, h: 31 },
    },
    {
      text: "The Runner cannot steal or trash Corp cards for the remainder of this run.",
      Resolve: function () {
        this.cannot.Resolve = function (str, card) {
          if (str == "steal") return true; //cannot steal
          if (str == "trash") {
            //runner cannot trash corp cards but other combinations are fine
            if (activePlayer == runner) {
              if (typeof card !== "undefined") {
                if (card !== null) {
                  if (card.player == corp) return true; //cannot trash
                }
              }
            }
          }
          return false; //nothing else forbidden
        };
        Log(
          "Runner cannot steal or trash Corp cards for the remainder of this run."
        );
      },
      visual: { y: 150, h: 46 },
    },
  ],
  //Lose [click]: Break 1 subroutine on this ice. Only the runner can use this ability.
  abilities: [
    {
      text: "Break 1 subroutine on this ice",
      Enumerate: function () {
        if (!CheckClicks(runner, 1)) return [];
        if (activePlayer !== runner) return [];
        if (!encountering) return [];
        if (GetApproachEncounterIce() != this) return [];
        var choices = [];
        for (var i = 0; i < this.subroutines.length; i++) {
          var subroutine = this.subroutines[i];
          if (!subroutine.broken)
            choices.push({
              subroutine: subroutine,
              label: 'Lose [click]: Break "' + subroutine.text + '"',
            });
        }
        return choices;
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        Break(params.subroutine);
      },
      opponentOnly: true,
    },
  ],
  activeForOpponent: true,
  //The runner cannot steal or trash Corp cards for the remainder of this run.
  cannot: {
    Resolve: function (str, card) {
      return false;
    }, //nothing forbidden by default
    availableWhenInactive: true,
  },
  runEnds: {
    Resolve: function (params) {
      this.cannot.Resolve = function (str, card) {
        return false;
      }; //nothing forbidden again
    },
    availableWhenInactive: true,
    automatic: true,
  },
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	if (rc.precalculated.runnerInstalledCardsLength > 0) {
	  //programs are run-critical. other things still not good but maybe ok
	  var installedPrograms = ChoicesInstalledCards(
		runner,
		function (card) {
		  return CheckCardType(card, ["program"]);
		}
	  );
	  if (installedPrograms.length > 0) result.sr.push([["misc_serious"]]);
	  else result.sr.push([["misc_moderate"]]);
	} else result.sr.push([[]]); //push a blank sr so that indices match
	if ((corp.HQ.cards.length == 0)&&(corp.archives.cards.length == 0)) result.sr.push([[]]); //push a blank sr so that indices match
	else result.sr.push([["misc_moderate"]]);
	if (incomplete) result.sr.push([[]]); //push a blank sr so that indices match
	else result.sr.push([["misc_serious"]]); //cannot steal or trash cards
	return result;
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    if (this == iceAI.ice) {
        if (clicksLeft > 0) {
          var breakresult = rc.SrBreak(this, iceAI, point, 1);
          for (var j = 0; j < breakresult.length; j++) {
            breakresult[j].runner_clicks_spent += 1;
          }
          result = result.concat(breakresult);
        }
    }
	return result;
  },
};
cardSet[30039] = {
  title: "Brân 1.0",
  imageFile: "30039.png",
  elo: 1656,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 2,
  cardType: "ice",
  rezCost: 6,
  strength: 6,
  subTypes: ["Barrier", "Bioroid"],
  //subroutines:
  //You may install 1 piece of ice from HQ or Archives directly inward from this ice, ignoring all costs.
  //End the run.
  //End the run.
  subroutines: [
    {
      text: "You may install 1 piece of ice from HQ or Archives directly inward from this ice, ignoring all costs.",
      Resolve: function (params) {
        var choicesA = [];
        var handOptions = ChoicesHandCards(corp, function (card) {
          return CheckCardType(card, ["ice"]);
        });
        if (handOptions.length > 0)
          choicesA.push({
            id: 0,
            label: "Install ice from HQ",
            button: "Install ice from HQ",
          });
        var archivesOptions = ChoicesArrayCards(
          corp.archives.cards,
          function (card) {
            return CheckCardType(card, ["ice"]);
          }
        );
        if (archivesOptions.length > 0)
          choicesA.push({
            id: 1,
            label: "Install ice from Archives",
            button: "Install ice from Archives",
          });
        choicesA.push({ id: 2, label: "Continue", button: "Continue" });
        function decisionCallbackA(params) {
          if (params.id < 2) {
            //i.e. didn't continue
            var choicesB = handOptions;
            if (params.id == 1) choicesB = archivesOptions;
            for (var i = 0; i < choicesB.length; i++) {
              choicesB[i].server = attackedServer;
            }
			//**AI code
			if (corp.AI != null) {
			  //choose highest printed rez cost ice which we would rez and can afford
			  var harcc = choicesB[0].card; //highest affordable rez cost card
			  var haprc = choicesB[0].card.rezCost; //highest affordable printed rez cost
			  var zerothRezCost = RezCost(harcc);
			  var wouldRez = CheckCredits(corp, zerothRezCost, "rezzing", harcc) && corp.AI._iceWorthRezzing(harcc, zerothRezCost, attackedServer);
			  for (var i=1; i<choicesB.length; i++) {
				  var possibleCard = choicesB[i].card;
				  if (possibleCard.rezCost > haprc || !wouldRez) {
					  var thisRezCost = RezCost(possibleCard);
					  if ( CheckCredits(corp, thisRezCost, "rezzing", possibleCard) && corp.AI._iceWorthRezzing(possibleCard, thisRezCost, attackedServer) ) {
						  harcc = possibleCard;
						  haprc = possibleCard.rezCost;
						  wouldRez = true;
					  }
				  }
			  }
			  //AI can nope out if it realises there are no good options (better to keep the ice in hand)
			  if (!wouldRez && params.id == 0) return; //the decision phase is skipped
			  corp.AI._log("I choose this one");			  
			  corp.AI.preferred = { command: "install", cardToInstall: harcc, serverToInstallTo:attackedServer };
			}
            //choose the ice to install
            function decisionCallbackB(params) {
              if (params.card !== null)
                Install(params.card, attackedServer, true, approachIce); //insert ice before current ice
            }
            DecisionPhase(
              corp,
              choicesB,
              decisionCallbackB,
              null,
              "Install ice, ignoring all costs",
              this,
              "install"
            );	
          }
        }
        DecisionPhase(
          corp,
          choicesA,
          decisionCallbackA,
          "Brân 1.0",
          "Brân 1.0",
          this
        );
        //**AI code
        if (corp.AI != null) {
          corp.AI._log("I know this one");
          //prefer archives if possible
          var choice = choicesA[0];
          if (archivesOptions.length > 0 && handOptions.length > 0)
            choice = choicesA[1];
          corp.AI.preferred = { title: "Brân 1.0", option: choice }; //title must match currentPhase.title for AI to fire
        }
      },
      visual: { y: 105, h: 46 },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 134, h: 16 },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 150, h: 16 },
    },
  ],
  //Lose [click]: Break 1 subroutine on this ice. Only the runner can use this ability.
  abilities: [
    {
      text: "Break 1 subroutine on this ice",
      Enumerate: function () {
        if (!CheckClicks(runner, 1)) return [];
        if (activePlayer !== runner) return [];
        if (!encountering) return [];
        if (GetApproachEncounterIce() != this) return [];
        var choices = [];
        for (var i = 0; i < this.subroutines.length; i++) {
          var subroutine = this.subroutines[i];
          if (!subroutine.broken)
            choices.push({
              subroutine: subroutine,
              label: 'Lose [click]: Break "' + subroutine.text + '"',
            });
        }
        return choices;
      },
      Resolve: function (params) {
        SpendClicks(runner, 1);
        Break(params.subroutine);
      },
      opponentOnly: true,
    },
  ],
  activeForOpponent: true,
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
    result.sr = [[["misc_serious"]], [["endTheRun"]], [["endTheRun"]]];
	return result;
  },
  AIImplementBreaker: function(rc,result,point,server,cardStrength,iceAI,iceStrength,clicksLeft,creditsLeft) {
	//note: args for ImplementIcebreaker are: point, card, cardStrength, iceAI, iceStrength, iceSubTypes, costToUpStr, amtToUpStr, costToBreak, amtToBreak, creditsLeft
    if (this == iceAI.ice) {
        if (clicksLeft > 0) {
          var breakresult = rc.SrBreak(this, iceAI, point, 1);
          for (var j = 0; j < breakresult.length; j++) {
            breakresult[j].runner_clicks_spent += 1;
          }
          result = result.concat(breakresult);
        }
    }
	return result;
  },
};
cardSet[30040] = {
  title: "Seamless Launch",
  imageFile: "30040.png",
  elo: 1845,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 2,
  cardType: "operation",
  playCost: 1,
  cardsInstalledThisTurn: [],
  corpTurnBegin: {
    Resolve: function () {
      this.cardsInstalledThisTurn = [];
    },
    automatic: true,
    availableWhenInactive: true,
  },
  cardInstalled: {
    Resolve: function (card) {
      if (!this.cardsInstalledThisTurn.includes(card))
        this.cardsInstalledThisTurn.push(card);
    },
    automatic: true,
    availableWhenInactive: true,
  },
  //Place 2 advancement counters on 1 installed card that you did not install this turn.
  Enumerate: function () {
    var choices = ChoicesInstalledCards(corp, function(card) {
		if (CheckAdvance(card)) {
			//**AI code
			if (corp.AI != null) return corp.AI._cardShouldBeFastAdvanced(card);
			return true;
		}
	});
    //now remove choices which were installed this turn
    for (var i = choices.length - 1; i > -1; i--) {
      if (this.cardsInstalledThisTurn.includes(choices[i].card))
        choices.splice(i, 1);
    }
	//**AI code
	if (corp.AI != null) {
		if (this.AIPreferredTarget) {
			for (var i=0; i<choices.length; i++) {
				if (choices[i].card == this.AIPreferredTarget) return [choices[i]];
			}
		}
		Shuffle(choices); //make the advance target unpredictable (could use a heuristic instead maybe?)
	}
    return choices;
  },
  Resolve: function (params) {
    PlaceAdvancement(params.card, 2);
  },
  AIFastAdvance:true, //is a card for fast advancing
};
cardSet[30041] = {
  title: "Sprint",
  imageFile: "30041.png",
  elo: 1635,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 1,
  cardType: "operation",
  playCost: 0,
  //Draw 3 cards. Shuffle 2 cards from HQ into R&D.
  // new code (1 card a time)
  Resolve: function (params) {
    Draw(corp, 3, function() {
		var choicesA = ChoicesHandCards(corp);
		//drag and drop onto R&D
		for (var i = 0; i < choicesA.length; i++) {
		  choicesA[i].server = corp.RnD;
		}
		var decisionCallbackA = function (params) {
		  Log(GetTitle(params.card, true) + " shuffled into R&D from HQ");
		  MoveCard(params.card, corp.RnD.cards);
		  var choicesB = ChoicesHandCards(corp);
		  //drag and drop onto R&D
		  for (var i = 0; i < choicesB.length; i++) {
			choicesB[i].server = corp.RnD;
		  }
		  var decisionCallbackB = function (params) {
			Log(GetTitle(params.card, true) + " shuffled into R&D from HQ");
			MoveCard(params.card, corp.RnD.cards);
			Shuffle(corp.RnD.cards);
		  };
		  var phaseB = DecisionPhase(
			corp,
			choicesB,
			decisionCallbackB,
			"Sprint",
			"Drag to R&D",
			this
		  );
		  phaseB.targetServerCardsOnly = true;
		  //**AI code
		  if (corp.AI != null) {
			var choiceB = corp.AI._reduceOptionsToBestCardToReturnToRnD(choicesB)[0];
			corp.AI.preferred = { title: "Sprint", option: choiceB }; //title must match currentPhase.title for AI to fire
		  }
		};
		var phaseA = DecisionPhase(
		  corp,
		  choicesA,
		  decisionCallbackA,
		  "Sprint",
		  "Drag to R&D",
		  this
		);
		phaseA.targetServerCardsOnly = true;
		//**AI code
		if (corp.AI != null) {
		  var choiceA = corp.AI._reduceOptionsToBestCardToReturnToRnD(choicesA)[0];
		  corp.AI.preferred = { title: "Sprint", option: choiceA }; //title must match currentPhase.title for AI to fire
		}
	},this);
  },
};
cardSet[30042] = {
  title: "Manegarm Skunkworks",
  imageFile: "30042.png",
  elo: 1814,
  player: corp,
  faction: "Haas-Bioroid",
  influence: 3,
  cardType: "upgrade",
  rezCost: 2,
  trashCost: 3,
  unique: true,
  AIDefensiveValue: function(server) {
	  return 4; //arbitrary, observe and tweak
  },
  //Whenever the Runner approaches this server, end the run unless they either spend [click][click] or pay 5[c].
  //"The Runner approaches the server at step 4 of a run, and it is the final deciding factor for determining the success of a run." (see also run timing in FAQ)
  AIWouldTrigger: function () {
	//almost always yes, unless nonbo with kill condition
	if (corp.AI._potentialDamageOnBreach(attackedServer) > runner.grip.length) return false;
    return true;
  },
  approachServer: {
    Enumerate: function () {
      if (attackedServer == GetServer(this)) return [{}];
      return [];
    },
    Resolve: function (params) {
      var choices = [];
      if (CheckClicks(runner, 2))
        choices.push({
          id: 0,
          label: "Spend [click][click]",
          button: "Spend [click][click]",
        });
      if (CheckCredits(runner, 5, "", this))
        choices.push({ id: 1, label: "Spend 5[c]", button: "Pay 5[c]" });
      choices.push({ id: 2, label: "End the run", button: "End the run" });
      function decisionCallback(params) {
        if (params.id == 0) {
          SpendClicks(runner, 2);
        } else if (params.id == 1) {
          SpendCredits(runner, 5);
        } else EndTheRun();
      }
      DecisionPhase(
        runner,
        choices,
        decisionCallback,
        "Manegarm Skunkworks",
        "Manegarm Skunkworks",
        this
      );
      //**AI code
      if (runner.AI != null) {
        runner.AI._log("I know this one");
        var choice = choices[0];
        if (!runner.AI._calculateBestCompleteRun(
            attackedServer,
            0,
			0,
            0,
            0,
			null, //no bonus breaker
            approachIce
        )) {
          //no complete run path, don't bother paying the fee
          choice = choices[choices.length - 1];
        } else {
          //prefer clicks, then credits (unless rich in which case prefer credits)
          if (choices.length > 2 && AvailableCredits(runner) > 9)
            choice = choices[1]; //the credit min is arbitrary (should cover this tax + a trash cost or two)
        }
        runner.AI.preferred = { title: "Manegarm Skunkworks", option: choice }; //title must match currentPhase.title for AI to fire
      }
    },
    text: "Whenever the Runner approaches this server",
  },
  RezUsability: function () {
    if (currentPhase.identifier == "Run 4.5" && approachIce < 1) {
      if (attackedServer == GetServer(this)) return true;
    }
    return false;
  },
};
cardSet[30043] = {
  title: "Jinteki: Restoring Humanity",
  imageFile: "30043.png",
  elo: 1517,
  player: corp,
  faction: "Jinteki",
  cardType: "identity",
  deckSize: 40,
  influenceLimit: 15,
  subTypes: ["Megacorp"],
  //When your discard phase ends, if there is a facedown card in Archives, gain 1[c].
  corpDiscardEnds: {
    Enumerate: function () {
      for (var i = 0; i < corp.archives.cards.length; i++) {
        if (!IsFaceUp(corp.archives.cards[i])) return [{}];
      }
      return [];
    },
    Resolve: function (params) {
      GainCredits(corp, 1);
    },
    text: "When your discard phase ends",
  },
};
cardSet[30044] = {
  title: "Longevity Serum",
  imageFile: "30044.png",
  elo: 1631,
  player: corp,
  faction: "Jinteki",
  cardType: "agenda",
  subTypes: ["Research"],
  agendaPoints: 2,
  advancementRequirement: 3,
  limitPerDeck: 1,
  AICardsDiscarded: [],
  SharedDecisionCallback: function(params) {
	if (params.card) {
		Trash(params.card);
		if (corp.AI != null) this.AICardsDiscarded.push(params.card);
		if (corp.HQ.cards.length > 0) {
			this.SharedTrashFromHQDecision();
			return;
		}
	}
	//Shuffle up to 3 cards from Archives into R&D.
	var choices = ChoicesArrayCards(corp.archives.cards);
	choices.push({ label: "Continue", button: "Continue" });
	for (var i = 0; i < choices.length; i++) {
	  choices[i].cards = [null, null, null];
	} //set up a multiple-select for up to three cards
	var decisionCallback = function (params) {
	  var cardsShuffled = 0;
	  for (var i = 0; i < params.cards.length; i++) {
		if (params.cards[i] !== null) {
		  Log(
			GetTitle(params.cards[i], true) +
			  " shuffled into R&D from Archives"
		  );
		  MoveCard(params.cards[i], corp.RnD.cards);
		  cardsShuffled++;
		}
	  }
	  Shuffle(corp.RnD.cards);
	  if (cardsShuffled == 0) Log("R&D shuffled");
	};
	DecisionPhase(
	  corp,
	  choices,
	  decisionCallback,
	  "Longevity Serum",
	  "Longevity Serum",
	  this
	);
	//**AI code
	if (corp.AI != null) {
	  corp.AI._log("I know this one");
	  var desiredCards = [];
	  //start with any agendas
	  for (var i = 0; desiredCards.length < 3 && i < corp.archives.cards.length; i++) {
		  if (CheckCardType(corp.archives.cards[i], ["agenda"])) desiredCards.push(corp.archives.cards[i]);
	  }
	  //then other cards that were just trashed
	  for (var i = 0; desiredCards.length < 3 && i < this.AICardsDiscarded.length; i++) {
		  if (!desiredCards.includes(this.AICardsDiscarded[i])) desiredCards.push(this.AICardsDiscarded[i]);
	  }
	  //then any other cards
	  for (var i = 0; desiredCards.length < 3 && i < corp.archives.cards.length; i++) {
		  desiredCards.push(corp.archives.cards[i]);
	  }
	  //save and set to prefer
	  for (var i = 0; i < desiredCards.length; i++) {
		choices[0].cards[i] = desiredCards[i];
	  }
	  var choice = choices[0];
	  corp.AI.preferred = { title: "Longevity Serum", option: choice }; //title must match currentPhase.title for AI to fire
	}
  },
  SharedTrashFromHQDecision: function() {
    var choices = ChoicesArrayCards(corp.HQ.cards);
    choices.push({ label: "Continue", button: "Continue" });
	var decisionCallback = this.SharedDecisionCallback;
    DecisionPhase(
      corp,
      choices,
      decisionCallback,
      "Longevity Serum",
      "Longevity Serum",
	  this,
	  "discard" //i.e. drag to Archives	
    );
    //**AI code
    if (corp.AI != null) {
        corp.AI._log("I know this one");
        //just arbitrary for now (but always if over hand limit)
        var choice = choices[0];
		//but don't discard more than 3
		if (this.AICardsDiscarded.length > 2) choice = choices[choices.length-1]; //continue
		else if (PlayerHand(corp).length <= MaxHandSize(corp) && Math.random() < 0.7) choice = choices[choices.length-1]; //continue
        corp.AI.preferred = { title: "Longevity Serum", option: choice }; //title must match currentPhase.title for AI to fire
    }
  },
  scored: {
    Enumerate: function () {
      if (intended.score == this) return [{}];
      return [];
    },
    Resolve: function (params) {
	  if (corp.AI != null) this.AICardsDiscarded = [];
      //When you score this agenda, trash any number of cards from HQ.
	  this.SharedTrashFromHQDecision();
    },
    text: "When you score this agenda",
  },
};
cardSet[30045] = {
  title: "Urtica Cipher",
  imageFile: "30045.png",
  elo: 1566,
  player: corp,
  faction: "Jinteki",
  influence: 2,
  cardType: "asset",
  subTypes: ["Ambush"],
  rezCost: 0,
  canBeAdvanced: true,
  trashCost: 2,
  advancement: 0,
  //When the Runner accesses this asset while it is installed, do 2 net damage plus 1 net damage for each hosted advancement counter.
  cardAccessed: {
    Resolve: function (card) {
      if (card == this) {
        if (CheckInstalled(this)) {
          NetDamage(2 + this.advancement);
        }
      }
    },
  },
  RezUsability: function () {
    return false;
  }, //never rez (for usability rather than legality)
  AIAdvancementLimit: function() {
	  return 4; //this may be overridden to bluff under certain circumstances
  },
};
cardSet[30046] = {
  title: "Diviner",
  imageFile: "30046.png",
  elo: 1463,
  player: corp,
  faction: "Jinteki",
  influence: 2,
  cardType: "ice",
  rezCost: 2,
  strength: 3,
  subTypes: ["Code Gate", "AP"],
  //subroutines:
  //Do 1 net damage. If you trash a card with a printed play or install cost that is an odd number, end the run. (0 is not odd.)
  subroutines: [
    {
      text: "Do 1 net damage. If you trash a card with a printed play or install cost that is an odd number, end the run.",
      Resolve: function () {
        NetDamage(1, function (cardsTrashed) {
          if (cardsTrashed.length > 0) {
            printedCost = 0;
            if (typeof cardsTrashed[0].installCost !== "undefined")
              printedCost = cardsTrashed[0].installCost;
            else if (typeof cardsTrashed[0].playCost !== "undefined")
              printedCost = cardsTrashed[0].playCost;
            Log(
              GetTitle(cardsTrashed[0], true) +
                " has a printed cost of " +
                printedCost
            );
            if (printedCost % 2 == 1) EndTheRun(); //printed cost is odd
          }
        });
      },
      visual: { y: 79, h: 66 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	var secondEffect = "endTheRun";
	var evenCardsInHand = 0;
	//if corp is running the rc, skip hidden information
	if (!runner.AI || runner.AI.rc !== rc) {
		result.sr = [[["netDamage","misc_moderate"]]];
		return result;
	}	
	for (var i = 0; i < runner.grip.length; i++) {
	  var printedCost = 0;
	  if (typeof runner.grip[i].installCost !== "undefined")
		printedCost = runner.grip[i].installCost;
	  else if (typeof runner.grip[i].playCost !== "undefined")
		printedCost = runner.grip[i].playCost;
	  if (printedCost % 2 != 1) evenCardsInHand++;
	}
	result.sr = [[["netDamage"]]];
	//if all cards in hand are even then there is no second effect
	//but don't rely on luck if you're also spending to get past other ice first
	var theServer = GetServer(this);
	var rezzedIceBeforeThis = 0;
	var examiningIdx = theServer.ice.length-1;
	while (theServer.ice[examiningIdx] != this && examiningIdx > -1) {
		if (theServer.ice[examiningIdx].rezzed) rezzedIceBeforeThis++;
		examiningIdx --;
	}
	//don't rely too heavily on luck (the 0.7 is arbitrary) or try to luck past inner ice
	if (evenCardsInHand < runner.grip.length * 0.7 || (evenCardsInHand < runner.grip.length && rezzedIceBeforeThis > 0) ) result.sr[0][0].push("endTheRun");
	else if (evenCardsInHand < runner.grip.length)
	  result.sr[0][0].push("misc_moderate"); //maybe will end, maybe not
	return result;
  },
};
cardSet[30047] = {
  title: "Karunā",
  imageFile: "30047.png",
  elo: 1477,
  player: corp,
  faction: "Jinteki",
  influence: 2,
  cardType: "ice",
  rezCost: 4,
  strength: 3,
  subTypes: ["Sentry", "AP"],
  //subroutines:
  //Do 2 net damage. The Runner may jack out.
  //Do 2 net damage.
  subroutines: [
    {
      text: "Do 2 net damage. The Runner may jack out.",
      Resolve: function () {
        NetDamage(2, function (cardsTrashed) {
          var choices = BinaryDecision(
            runner,
            "Jack out",
            "Continue",
            "Karunā",
            this,
            function () {
              JackOut();
            }
          );
        });
      },
      visual: { y: 65, h: 31 },
    },
    {
      text: "Do 2 net damage.",
      Resolve: function () {
        NetDamage(2);
      },
      visual: { y: 87, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	result.sr = [
	  [
		["netDamage", "netDamage", "endTheRun"],
		["netDamage", "netDamage"],
	  ],
	  [["netDamage", "netDamage"]],
	];
	return result;
  },
};
cardSet[30048] = {
  title: "Hansei Review",
  imageFile: "30048.png",
  elo: 1654,
  player: corp,
  faction: "Jinteki",
  influence: 1,
  cardType: "operation",
  subTypes: ["Transaction"],
  playCost: 5,
  //Gain 10[c]. If there are any cards in HQ, trash 1 of them.
  Enumerate: function () {
    if (corp.HQ.cards.length > 0) return ChoicesArrayCards(corp.HQ.cards);
    else return [{}];
  },
  Resolve: function (params) {
    GainCredits(corp, 10);
    if (params.card) Trash(params.card);
  },
  command: "discard",
};
cardSet[30049] = {
  title: "Neurospike",
  imageFile: "30049.png",
  elo: 1678,
  player: corp,
  faction: "Jinteki",
  influence: 3,
  cardType: "operation",
  subTypes: ["Grey Ops"],
  playCost: 3,
  //Do X net damage, where X is equal to the sum of the printed agenda points on agendas you scored this turn.
  printedAgendaPointsThisTurn: 0,
  Enumerate: function () {
    if (this.printedAgendaPointsThisTurn > 0) return [{}];
    else return [];
  },
  Resolve: function (params) {
    NetDamage(this.printedAgendaPointsThisTurn);
  },
  scored: {
    Resolve: function () {
      if (intended.score !== null)
        this.printedAgendaPointsThisTurn += intended.score.agendaPoints; //note printed points, no modifiers
    },
    automatic: true,
    availableWhenInactive: true,
  },
  runnerDiscardEnds: {
    Resolve: function () {
      this.printedAgendaPointsThisTurn = 0;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  corpDiscardEnds: {
    Resolve: function () {
      this.printedAgendaPointsThisTurn = 0;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  AIDamageOperation: true,
};
cardSet[30050] = {
  title: "Anoetic Void",
  imageFile: "30050.png",
  elo: 1911,
  player: corp,
  faction: "Jinteki",
  influence: 4,
  cardType: "upgrade",
  rezCost: 0,
  trashCost: 1,
  unique: true,
  AIDefensiveValue: function(server) {
	//don't install to create a new server
	if (!server) return 0;
	//don't install in central server
	if (typeof server.cards != 'undefined') return 0;
	//don't install if there isn't already some protection
	if (server.ice.length < 1) return 0;
	return 3; //arbitrary, observe and tweak
  },
  //Whenever the Runner approaches this server, you may pay 2[c] and trash 2 cards from HQ.
  //If you do, end the run.
  //"The Runner approaches the server at step 4 of a run, and it is the final deciding factor for determining the success of a run." (see also run timing in FAQ)
  AIWouldTrigger: function () {
    var thisServer = GetServer(this);
	//don't trigger if there is an ambush intalled in server
	if (corp.AI._isAmbush(thisServer)) return false; //don't trigger
    //don't trigger if there are no other cards in this server
    var cardsInServer = 0;
    if (typeof thisServer.cards !== "undefined")
      cardsInServer += thisServer.cards.length;
    cardsInServer += thisServer.root.length;
    if (cardsInServer < 2) return false; //don't trigger
    if (corp.HQ.cards.length - corp.AI._agendasInHand() < 2) return false; //or we would be throwing out agendas
    //TODO situations in which throwing out the agendas would be preferable e.g. high agenda density in hand, or have Spin Doctor installed
    //and they would be safer in Archives e.g. no runner clicks left or spin doctor is in hand (with a click remaining) or play
    return true;
  },
  approachServer: {
    Enumerate: function () {
      if (attackedServer == GetServer(this)) {
        if (CheckCredits(corp, 2, "", this)) {
          if (corp.HQ.cards.length > 1) return [{}];
        }
      }
      return [];
    },
    Resolve: function (params) {
      var binaryChoices = BinaryDecision(
        corp,
        "Pay 2[c] and trash 2 cards from HQ",
        "Continue",
        "Anoetic Void",
        this,
        function () {
          SpendCredits(corp, 2);
          //new code (drag to Archives one at a time)
          var choicesA = ChoicesHandCards(corp);
          function decisionCallbackA(paramsA) {
            Trash(paramsA.card);
            var choicesB = ChoicesHandCards(corp);
            function decisionCallbackB(params) {
              Trash(params.card);
              EndTheRun();
            }
            DecisionPhase(
              corp,
              choicesB,
              decisionCallbackB,
              "Anoetic Void",
              "Discard",
              this,
              "discard"
            );
          }
          DecisionPhase(
            corp,
            choicesA,
            decisionCallbackA,
            "Anoetic Void",
            "Discard",
            this,
            "discard"
          );
        }
      );
      //**AI code
      if (corp.AI != null) {
        corp.AI._log("I know this one");
        var choice = binaryChoices[0]; //activate by default
        if (!this.AIWouldTrigger()) choice = binaryChoices[1]; //don't activate
        corp.AI.preferred = { title: "Anoetic Void", option: choice }; //title must match currentPhase.title for AI to fire
      }
    },
    text: "Whenever the Runner approaches this server",
  },
  RezUsability: function () {
    if (currentPhase.identifier == "Run 4.5" && approachIce < 1) {
      if (attackedServer == GetServer(this)) return true;
    }
    return false;
  },
};
cardSet[30051] = {
  title: "NBN: Reality Plus",
  imageFile: "30051.png",
  elo: 1623,
  player: corp,
  faction: "NBN",
  cardType: "identity",
  deckSize: 40,
  influenceLimit: 15,
  subTypes: ["Megacorp"],
  usedThisTurn: false,
  runnerTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  corpTurnBegin: {
    Resolve: function () {
      this.usedThisTurn = false;
    },
    automatic: true,
  },
  tagsTaken: {
    Enumerate: function () {
      var choices = [];
      if (!this.usedThisTurn) {
        choices.push({ id: 0, label: "Gain 2[c]", button: "Gain 2[c]" });
        if (corp.RnD.cards.length > 1) choices.push({ id: 1, label: "Draw 2 cards", button: "Draw 2 cards" });
      }
      return choices;
    },
    Resolve: function (params) {
      this.usedThisTurn = true;
      if (params.id == 0) GainCredits(corp, 2);
      else Draw(corp, 2);
    },
  },
};
cardSet[30052] = {
  title: "Tomorrow's Headline",
  imageFile: "30052.png",
  elo: 1762,
  player: corp,
  faction: "NBN",
  cardType: "agenda",
  subTypes: ["Ambush"],
  agendaPoints: 2,
  advancementRequirement: 3,
  limitPerDeck: 1,
  scored: {
    Enumerate: function () {
      if (intended.score == this) return [{}];
      return [];
    },
    Resolve: function () {
      AddTags(1);
    },
  },
  stolen: {
    Enumerate: function () {
      if (intended.steal == this) return [{}];
      return [];
    },
    Resolve: function () {
      AddTags(1);
    },
  },
};
cardSet[30053] = {
  title: "Spin Doctor",
  imageFile: "30053.png",
  elo: 1890,
  player: corp,
  faction: "NBN",
  influence: 1,
  cardType: "asset",
  subTypes: ["Character"],
  rezCost: 0,
  unique: true,
  trashCost: 2,
  //When you rez this asset, draw 2 cards.
  cardRezzed: {
    Resolve: function (card) {
      if (card == this) {
        Draw(corp, 2);
        Render(); //needed to show the cards were drawn
      }
    },
  },
  //helper functions for the ability
  AISharedChoose: function (choices) {
    //get preferred index
    corp.AI._log("I know this one");
    //agendas are top priority
    for (
      var i = 0;
      i < choices.length - 1;
      i++ //length-1 to ignore the Continue option
    ) {
      if (typeof choices[i].card !== "undefined") {
        if (CheckCardType(choices[i].card, ["agenda"])) return i;
      }
    }
    //then facedown cards (to preserve information)
    for (
      var i = 0;
      i < choices.length - 1;
      i++ //length-1 to ignore the Continue option
    ) {
      if (typeof choices[i].card !== "undefined") {
        if (!IsFaceUp(choices[i].card)) return i;
      }
    }
    //otherwise just arbitrary (the ones most recently added)
    return 0;
  },
  SharedDecision: function (decisionCallback, firstCard = true) {
    var choices = ChoicesArrayCards(corp.archives.cards);
    if (firstCard)
      choices.push({
        label: "Continue without shuffling a card from Archives into R&D",
        button: "Continue without shuffling a card from Archives into R&D",
      });
    else
      choices.push({
        label: "Continue without shuffling another card from Archives into R&D",
        button:
          "Continue without shuffling another card from Archives into R&D",
      });
    for (var i = 0; i < choices.length - 1; i++) {
      choices[i].server = corp.RnD;
    }
    //**AI code (in this case, implemented by setting and returning the preferred option)
    if (corp.AI != null) choices = [choices[this.AISharedChoose(choices)]];
    var phase = DecisionPhase(
      corp,
      choices,
      decisionCallback,
      "Spin Doctor",
      "Drag to R&D",
      this
    );
    phase.targetServerCardsOnly = true;
  },
  //Remove this asset from the game: Shuffle up to 2 cards from Archives into R&D.
  abilities: [
    {
      text: "Remove this asset from the game: Shuffle up to 2 cards from Archives into R&D",
      // new code (1 card a time)
      Enumerate: function () {
        return [{}];
      },
      Resolve: function (params) {
        RemoveFromGame(this);
        var decisionCallbackA = function (params) {
          if (typeof params.card !== "undefined") {
            Log(GetTitle(params.card, true) + " shuffled into R&D from Archives");
            MoveCard(params.card, corp.RnD.cards);
            var decisionCallbackB = function (params) {
              if (typeof params.card !== "undefined") {
                Log(GetTitle(params.card, true) + " shuffled into R&D from Archives");
                MoveCard(params.card, corp.RnD.cards);
              }
              Shuffle(corp.RnD.cards);
            };
            this.SharedDecision(decisionCallbackB, false);
          } //no cards moved, just shuffle R&D
          else {
            Shuffle(corp.RnD.cards);
            Log("R&D shuffled");
          }
        };
        this.SharedDecision(decisionCallbackA);
      },
      /* OLD CODE (multi-select)
			Enumerate: function() {
				var choices = ChoicesArrayCards(corp.archives.cards);
				choices.push( { label:"Continue", button:"Continue" } );
				for (var i=0; i<choices.length; i++) { choices[i].cards = [null,null]; } //set up a multiple-select for up to two cards
				//**AI code (in this case, implemented by setting and returning the preferred option)
				if (corp.AI != null)
				{
					corp.AI._log("I know this one");
					//agendas are top priority
					var favouredChoices = [];
					for (var i=0; (favouredChoices.length<2) && (i<corp.archives.cards.length); i++)
					{
						if (CheckCardType(choices[i].card,["agenda"])) favouredChoices.push(choices[i]);
					}						
					//then facedown cards (to preserve information)
					for (var i=0; (favouredChoices.length<2) && (i<corp.archives.cards.length); i++)
					{
						if (!favouredChoices.includes(choices[i]))
						{
							if (!IsFaceUp(choices[i].card)) favouredChoices.push(choices[i]);
						}
					}						
					//otherwise just arbitrary (the ones most recently added)
					for (var i=0; (favouredChoices.length<2) && (i<corp.archives.cards.length); i++)
					{
						if (!favouredChoices.includes(choices[choices.length-2-i])) favouredChoices.push(choices[choices.length-2-i]);
					}
					//save favoured choices into first and choose it
					if (favouredChoices.length > 0) choices[0].cards[0] = favouredChoices[0].card;
					if (favouredChoices.length > 1) choices[0].cards[1] = favouredChoices[1].card;
					return choices = [choices[0]];
				}
				return choices;
			},
			Resolve: function(params) {
				RemoveFromGame(this);
				var cardsShuffled = 0;
				for (var i=0; i<params.cards.length; i++)
				{
					if (params.cards[i] !== null)
					{
						Log(GetTitle(params.cards[i],true)+" shuffled into R&D from Archives");
						MoveCard(params.cards[i],corp.RnD.cards);
						cardsShuffled++;
					}
				}
				Shuffle(corp.RnD.cards);
				if (cardsShuffled == 0) Log("R&D shuffled");
			}
			*/
    },
  ],
  //**AI code for installing (return -1 to not install, index in emptyProtectedRemotes to install in a specific server, or emptyProtectedRemotes.length to install in a new server)
  AIWorthInstalling: function (emptyProtectedRemotes) {
    for (var i = 0; i < corp.archives.cards.length; i++) {
      if (
        !IsFaceUp(corp.archives.cards[i]) ||
        CheckCardType(corp.archives.cards[i], ["agenda"])
      ) {
        //could also do it with face up cards that we want to reuse but this is fine for now
        //choose the first non-scoring server (create one if necessary)
        for (var j = 0; j < emptyProtectedRemotes.length; j++) {
          if (!corp.AI._isAScoringServer(emptyProtectedRemotes[j])) return j;
        }
        return emptyProtectedRemotes.length;
      }
    }
    return -1; //don't install
  },
  //shared usability returns true for both rez and trigger (in this case - this is internal to Spin Doctor implementation)
  SharedUsability: function() {
    if (currentPhase.identifier == "Run 4.5" && approachIce < 1) {
      if (attackedServer == GetServer(this)) return true;
      if (attackedServer == corp.RnD) return true; //since we might want to shuffle R&D
      if (attackedServer == corp.HQ) return true; //since we might want to draw extra cards
      if (attackedServer == corp.archives && corp.archives.cards.length > 0)
        return true; //since we might want to remove cards from archives
    }
    if (currentPhase.identifier == "Corp 2.2") return true; //might want to rez for the extra card draw (and therefore we allow trigger here too)
	return false;
  },
  RezUsability: function () {
	if (this.SharedUsability()) return true;
	//this next check allows the AI to rez for extra card draw (its phases are split into 2.2 and 2.2*)
	if (corp.AI != null) {
		if (typeof(this.AITurnsInstalled) !== 'undefined') {
			if ( CheckClicks(corp, 1) && (this.AITurnsInstalled > 1) ) return true;
		}
	}
    return false;
  },
  TriggerUsability: function() {
	  return this.SharedUsability();
  },
  AITriggerWhenCan: true,
  AIAvoidInstallingOverThis: true,
};
cardSet[30054] = {
  title: "Funhouse",
  imageFile: "30054.png",
  elo: 1594,
  player: corp,
  faction: "NBN",
  influence: 2,
  cardType: "ice",
  subTypes: ["Code Gate"],
  rezCost: 5,
  strength: 4,
  //When the Runner encounters this ice, end the run unless the Runner takes 1 tag.
  encounter: {
    Enumerate: function (card) {
      if (card == this) {
        var choices = [
          { id: 0, label: "Take 1 tag", button: "Take 1 tag" },
          { id: 1, label: "End the run", button: "End the run" },
        ];
        //**AI code
        if (runner.AI != null) {
          var choice = choices[0]; //take the tag by default
          if (!runner.AI.cachedBestPath || !runner.AI.cachedComplete) {
			runner.AI._log("I was not expecting this");
            choice = choices[1]; //etr preferred because no acceptable path through the run
		  } else {
			if (!runner.AI.rc.PointIncludesBypass(runner.AI.cachedBestPath[0])) {
				runner.AI._log("I've committed to this");  
			}
		  }
          choices = [choice];
        }
		return choices;
      }
	  else return [];
	},
    Resolve: function (params) {
      if (params.id == 0) AddTags(1);
      else EndTheRun();
    },
  },
  //Give the Runner 1 tag unless they pay 4[c]
  subroutines: [
    {
      text: "Give the Runner 1 tag unless they pay 4[c].",
      Resolve: function (params) {
        var choices = [];
        if (CheckCredits(runner, 4))
          choices.push({ id: 0, label: "Pay 4[c]", button: "Pay 4[c]" });
        choices.push({ id: 1, label: "Take 1 tag", button: "Take 1 tag" });
        function decisionCallback(params) {
          if (params.id == 0) SpendCredits(runner, 4);
          else AddTags(1);
        }
        DecisionPhase(
          runner,
          choices,
          decisionCallback,
          "Funhouse",
          "Funhouse",
          this
        );
      },
      visual: { y: 110, h: 31 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	result.encounterEffects = [["endTheRun"], ["tag"]];
	result.sr = [
	  [["payCredits", "payCredits", "payCredits", "payCredits"], ["tag"]], //pay 4 credits
	];
	return result;
  },
};
cardSet[30055] = {
  title: "Ping",
  imageFile: "30055.png",
  elo: 1652,
  player: corp,
  faction: "NBN",
  influence: 2,
  cardType: "ice",
  subTypes: ["Barrier"],
  rezCost: 2,
  strength: 1,
  //When you rez this ice during a run against this server, give the Runner 1 tag
  cardRezzed: {
    Resolve: function (card) {
      if (card == this) {
        if (attackedServer !== null) {
          if (attackedServer == GetServer(this)) AddTags(1);
        }
      }
    },
  },
  //subroutines:
  //End the run.
  subroutines: [
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 102, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
    result.sr = [[["endTheRun"]]];
	return result;
  },
};
cardSet[30056] = {
  title: "Predictive Planogram",
  imageFile: "30056.png",
  elo: 1637,
  player: corp,
  faction: "NBN",
  influence: 1,
  cardType: "operation",
  subTypes: ["Transaction"],
  playCost: 0,
  //Resolve 1 of the following. If the Runner is tagged, you may resolve both instead.
  //Gain 3[c]
  //Draw 3 cards
  Enumerate: function () {
    var choices = [];
    choices.push({ id: 0, label: "Gain 3[c]", button: "Gain 3[c]" });
    choices.push({ id: 1, label: "Draw 3 cards", button: "Draw 3 cards" });
    if (CheckTags(1)) {
      //**AI code (in this case, implemented by returning only the preferred option)
      if (corp.AI != null) choices = []; //both might not always be the best choice but oh well for now
      choices.push({ id: 2, label: "Both", button: "Both" });
    }
    return choices;
  },
  Resolve: function (params) {
    if (params.id != 1) GainCredits(corp, 3);
    if (params.id != 0) Draw(corp, 3);
  },
};
cardSet[30057] = {
  title: "Public Trail",
  imageFile: "30057.png",
  elo: 1630,
  player: corp,
  faction: "NBN",
  influence: 2,
  cardType: "operation",
  subTypes: ["Gray Ops"],
  playCost: 4,
  //Play only if the Runner made a successful run during their last turn.
  successfulRunLastTurn: false,
  runnerTurnBegin: {
    Resolve: function (params) {
      this.successfulRunLastTurn = false;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  runSuccessful: {
    Resolve: function (params) {
      this.successfulRunLastTurn = true;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  Enumerate: function () {
    if (this.successfulRunLastTurn) {
		return [{}];
	}
    return [];
  },
  //Give the Runner 1 tag unless they pay 8[c].
  Resolve: function (params) {
    var choices = [];
    if (CheckCredits(runner, 8))
      choices.push({ id: 0, label: "Pay 8[c]", button: "Pay 8[c]" });
    choices.push({ id: 1, label: "Take 1 tag", button: "Take 1 tag" });
    function decisionCallback(params) {
      if (params.id == 0) {
        SpendCredits(runner, 8);
      } else {
        AddTags(1);
      }
    }
    DecisionPhase(
      runner,
      choices,
      decisionCallback,
      "Public Trail",
      "Public Trail",
      this
    );
  },
  AIWouldPlay: function() {
	//don't bother unless can use it, also don't bother if the Runner has tags already (it's probably better to use the tags than add more)
	var ptp = corp.AI._potentialTagPunishment(runner.tags+1,corp.clickTracker-1,corp.creditPool-this.playCost) && corp.AI._clicksLeft() > 1 && runner.tags < 2;
	if (ptp) return true;
	return false;
  },
  AIWouldPlayBeforeScore: function (cardToScore, serverToScoreIn) {
	if (!CheckTags(1) && cardToScore.title == "Orbital Superiority") return true; //worth it to do that 4 meat damage!
    return false;
  },
};
cardSet[30058] = {
  title: "AMAZE Amusements",
  imageFile: "30058.png",
  elo: 1512,
  player: corp,
  faction: "NBN",
  influence: 3,
  cardType: "upgrade",
  rezCost: 1,
  trashCost: 3,
  unique: true,
  AIDefensiveValue: function(server) {
	  return 2; //arbitrary, observe and tweak
  },
  AIIsScoringUpgrade: true,
  runnerStoleAgendasThisRun: false,
  serverThisWasInstalledIn: null,
  runBegins: {
    Resolve: function (server) {
      //track agendas stolen every run in case attacked server changes mid-run
      this.runnerStoleAgendasThisRun = false;
      //store the server, in case this is trashed
      this.serverThisWasInstalledIn = GetServer(this); //GetServer returns null if not installed
    },
    automatic: true,
    availableWhenInactive: true,
  },
  stolen: {
    Resolve: function (params) {
      this.runnerStoleAgendasThisRun = true;
    },
    automatic: true,
    availableWhenInactive: true,
  },
  //Persistent (If the runner trashes this card while accessing it, this ability still applies for the remainder of the run.)
  cardTrashed: {
    Resolve: function (card) {
      if (card == this && this.rezzed && card == accessingCard) {
        this.runEnds.availableWhenInactive = true;
      }
    },
    automatic: true,
    availableWhenInactive: true,
  },
  //Whenever a run on this server ends, if the runner stole any agendas during that run, give the Runner 2 tags.
  runEnds: {
    Resolve: function (params) {
      var runEndedOnThisServer = false;
      if (attackedServer == GetServer(this)) runEndedOnThisServer = true;
      else if (this.serverThisWasInstalledIn !== null) {
        if (attackedServer == this.serverThisWasInstalledIn)
          runEndedOnThisServer = true;
      }
      if (runEndedOnThisServer) {
        if (this.runnerStoleAgendasThisRun) AddTags(2);
      }
      this.runEnds.availableWhenInactive = false; //Persistence ends after the run ends
    },
  },
  AIWouldTrigger: function () {
    //don't trigger if there are no known agendas in this server
    var thisServer = GetServer(this);
    if (typeof thisServer.cards !== "undefined") {
      for (var i = 0; i < thisServer.cards.length; i++) {
        if (PlayerCanLook(corp, thisServer.cards[i])) {
          if (CheckCardType(thisServer.cards[i], ["agenda"])) return true; //do trigger
        }
      }
    }
    for (var i = 0; i < thisServer.root.length; i++) {
      if (PlayerCanLook(corp, thisServer.root[i])) {
        if (CheckCardType(thisServer.root[i], ["agenda"])) return true; //do trigger
      }
    }
    return false; //don't trigger
  },
  RezUsability: function () {
    if (currentPhase.identifier == "Run 4.5" && approachIce < 1) {
      if (attackedServer == GetServer(this)) return true;
    }
    return false;
  },
};
cardSet[30059] = {
  title: "Weyland Consortium: Built to Last",
  imageFile: "30059.png",
  elo: 1590,
  player: corp,
  faction: "Weyland Consortium",
  cardType: "identity",
  deckSize: 40,
  influenceLimit: 15,
  subTypes: ["Megacorp"],
  //Whenever you advance a card, gain 2(c) if it had no advancement counters
  cardAdvanced: {
    Resolve: function (card) {
      if (card.advancement == 1) GainCredits(corp, 2); //if it has 1 now then it had none before
    },
  },
};
cardSet[30060] = {
  title: "Above the Law",
  imageFile: "30060.png",
  elo: 1757,
  player: corp,
  faction: "Weyland Consortium",
  cardType: "agenda",
  subTypes: ["Security"],
  agendaPoints: 2,
  advancementRequirement: 3,
  limitPerDeck: 1,
  //When you score this agenda, you may trash 1 installed resource.
  scored: {
    Enumerate: function () {
      if (intended.score == this) {
        if (
          ChoicesInstalledCards(runner, function (card) {
            //only include trashable resources
            if (CheckCardType(card, ["resource"]) && CheckTrash(card))
              return true;
            return false;
          }).length > 0
        )
          return [{}]; //this is a weird implementation but it allows us to have the AI use "trash" logic
      }
      return [];
    },
    Resolve: function (params) {
      var choices = ChoicesInstalledCards(runner, function (card) {
        //only include trashable resources
        if (CheckCardType(card, ["resource"]) && CheckTrash(card)) return true;
        return false;
      });
      choices.push({ card: null, label: "Continue", button: "Continue" });
      var decisionCallback = function (params) {
        if (params.card !== null) Trash(params.card, true);
      };
      DecisionPhase(
        corp,
        choices,
        decisionCallback,
        "Above the Law",
        "Above the Law",
        this,
        "trash"
      );
    },
    text: "Trash 1 installed resource",
  },
};
cardSet[30061] = {
  title: "Clearinghouse",
  imageFile: "30061.png",
  elo: 1666,
  player: corp,
  faction: "Weyland Consortium",
  influence: 3,
  cardType: "asset",
  subTypes: ["Hostile"],
  rezCost: 0,
  trashCost: 3,
  canBeAdvanced: true,
  //When your turn begins, you may trash this asset to do 1 meat damage for each hosted advancement counter.
  AIWouldTrigger: function () {
    var damageToDo = Counters(this, "advancement");
    if (PlayerHand(runner).length >= damageToDo) return false; //don't activate if the runner has lots of cards in hand (TODO consider further damage that could be dealt this turn)
    return true; //activate by default
  },
  AIOverAdvance: true, //load 'em up
  AIAdvancementLimit: function() {
	  return MaxHandSize(runner)+1;
  },
  AIRushToFinish: function() {
	  //use economy advance to get to limit if it is likely to be protected until start of turn
	  //this might not be the best check to use but it might be ok
	  return (corp.AI._serverToProtect() != GetServer(this));
  },
  corpTurnBegin: {
    Enumerate: function () {
      if (CheckCounters(this, "advancement", 1)) return [{}];
      return [];
    },
    Resolve: function (params) {
      var damageToDo = Counters(this, "advancement");
      var binaryChoices = BinaryDecision(
        corp,
        "Do " + damageToDo + " meat damage",
        "Continue",
        "Clearinghouse",
        this,
        function () {
          Trash(
            this,
            false,
            function () {
              MeatDamage(damageToDo);
            },
            this
          );
        }
      );
      //**AI code
      if (corp.AI != null) {
        corp.AI._log("I know this one");
        var choice = binaryChoices[0]; //activate by default
        if (!this.AIWouldTrigger()) choice = binaryChoices[1];
        corp.AI.preferred = { title: "Clearinghouse", option: choice }; //title must match currentPhase.title for AI to fire
      }
    },
    text: "Trash Clearinghouse to do meat damage",
  },
  RezUsability: function () {
    if (currentPhase.identifier == "Runner 2.2") return true;
    return false;
  },
};
cardSet[30062] = {
  title: "Ballista",
  imageFile: "30062.png",
  elo: 1581,
  player: corp,
  faction: "Weyland Consortium",
  influence: 2,
  cardType: "ice",
  subTypes: ["Sentry", "Destroyer"],
  rezCost: 5,
  strength: 4,
  AIWouldTrigger: function () {
    //in this case 'trigger' means trash a program instead of ending the run
    //which we'll do for central servers, if there is no agenda, or at random
    var thisServer = GetServer(this);
	if (typeof thisServer.cards != 'undefined') return true; //trash a program
    if (corp.AI._agendasInServer(thisServer) > 0) {
      if (Math.random() < 0.5) return false; //don't trigger (i.e., end the run)
    }
    return true; //trash a program
  },
  //Trash 1 installed program or end the run.
  subroutines: [
    {
      Resolve: function () {
        var choicesA = [];
        var choicesB = ChoicesInstalledCards(runner, function (card) {
          //only include trashable programs
          if (CheckCardType(card, ["program"]) && CheckTrash(card)) return true;
          return false;
        });
        if (choicesB.length > 0)
          choicesA.push({
            id: 0,
            label: "Trash 1 program",
            button: "Trash 1 program",
          });
        choicesA.push({ id: 1, label: "End the run", button: "End the run" });
        var decisionCallbackA = function (params) {
          if (params.id == 0) {
            var decisionCallbackB = function (params) {
              Trash(params.card, true);
            };
            DecisionPhase(
              corp,
              choicesB,
              decisionCallbackB,
              "Ballista",
              "Ballista",
              this,
              "trash"
            );
          } else EndTheRun();
        };
        DecisionPhase(
          corp,
          choicesA,
          decisionCallbackA,
          "Ballista",
          "Ballista",
          this
        );
        //**AI code
        if (corp.AI != null && choicesA.length > 1) {
          corp.AI._log("I know this one");
          var choice = choicesA[0]; //activate (trash a program) by default
          if (!this.AIWouldTrigger()) choice = choicesA[1]; //end the run
          corp.AI.preferred = { title: "Ballista", option: choice }; //title must match currentPhase.title for AI to fire
        }
      },
      text: "Trash 1 installed program or end the run.",
      visual: {
        y: 63,
        h: 31,
      },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	//If no programs are installed then corp will choose ETR
	var installedPrograms = ChoicesInstalledCards(runner, function (card) {
	  return CheckCardType(card, ["program"]);
	});
	if (installedPrograms.length > 0) result.sr = [
	  [["misc_serious"]],
	];
	else result.sr = [
	  [["endTheRun"]],
	];
	return result;
  },
};
cardSet[30063] = {
  title: "Pharos",
  imageFile: "30063.png",
  elo: 1588,
  player: corp,
  faction: "Weyland Consortium",
  influence: 3,
  cardType: "ice",
  subTypes: ["Barrier"],
  rezCost: 7,
  strength: 5,
  canBeAdvanced: true,
  //You can advance this ice.
  AIAdvancementLimit: function() {
	  //if unrezzed, only advance it if can afford to fully advance and rez
	  /*
	  if (!this.rezzed) {
		  var costToFullyAdvanceAndRez = 3 - Counters(this, "advancement") + RezCost(this);
		  if (!CheckCredits(corp, costToFullyAdvanceAndRez)) return 0;
	  }
	  */
	  //actually I've decided to only advance once rezzed, to preserve secrecy for now
	  if (!this.rezzed) return 0;
	  return 3;
  },
  //It gets +5 strength while there are 3 or more hosted advancement counters
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) {
        if (CheckCounters(this, "advancement", 3)) return 5; //+5
      }
      return 0; //no modification to strength
    },
  },
  //subroutines:
  //End the run.
  subroutines: [
    {
      text: "Give the Runner 1 tag.",
      Resolve: function () {
        AddTags(1);
      },
      visual: { y: 102, h: 16 },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 118, h: 16 },
    },
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 134, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
    result.sr = [[["tag"]], [["endTheRun"]], [["endTheRun"]]];
	return result;
  },
};
cardSet[30064] = {
  title: "Government Subsidy",
  imageFile: "30064.png",
  elo: 1691,
  player: corp,
  faction: "Weyland Consortium",
  influence: 1,
  cardType: "operation",
  subTypes: ["Transaction"],
  playCost: 10,
  //Gain 15[c]
  Resolve: function (params) {
    GainCredits(corp, 15);
  },
};
cardSet[30065] = {
  title: "Retribution",
  imageFile: "30065.png",
  elo: 1530,
  player: corp,
  faction: "Weyland Consortium",
  influence: 1,
  cardType: "operation",
  subTypes: ["Gray Ops"],
  playCost: 1,
  //Play only if the Runner is tagged
  Enumerate: function () {
    if (CheckTags(1)) {
      var choices = ChoicesInstalledCards(runner, function (card) {
        //only include trashable programs and hardware
        if (CheckCardType(card, ["program", "hardware"]) && CheckTrash(card))
          return true;
        return false;
      });
      if (corp.AI == null) {
        //human player
        return choices;
      } //**AI code: instead of returning the choices directly, this approach labels the action "trash" for AI's benefit
      else {
        if (choices.length > 0) return [{}];
      }
    }
    return [];
  },
  //Trash 1 installed program or piece of hardware.
  Resolve: function (params) {
    if (corp.AI == null) {
      //human player
      Trash(params.card, true);
    } //**AI code
    else {
      var choices = ChoicesInstalledCards(runner, function (card) {
        //only include trashable programs and hardware
        if (CheckCardType(card, ["program", "hardware"]) && CheckTrash(card))
          return true;
        return false;
      });
      var decisionCallback = function (params) {
        Trash(params.card, true);
      };
      DecisionPhase(
        corp,
        choices,
        decisionCallback,
        "Retribution",
        "Retribution",
        this,
        "trash"
      );
    }
  },
  AITagPunishment:1, //can be used to punish if at least 1 tag
};
cardSet[30066] = {
  title: "Malapert Data Vault",
  imageFile: "30066.png",
  elo: 1678,
  player: corp,
  faction: "Weyland Consortium",
  influence: 3,
  cardType: "upgrade",
  rezCost: 1,
  trashCost: 4,
  unique: true,
  AIIsScoringUpgrade: true,
  AIWouldRezBeforeScore: function (cardToScore, serverToRezIn) {
    var server = GetServer(this);
    if (typeof serverToRezIn !== "undefined") server = serverToRezIn;
    if (GetServer(cardToScore) == server) return true;
    return false;
  },
  scoringFromServer: null,
  score: {
    Resolve: function () {
      scoringFromServer = GetServer(intended.score);
    },
    automatic: true,
  },
  //Whenever you score an agenda from this server, you may search R&D for 1 non-agenda card and reveal it. (Shuffle R&D after searching it.) Add that card to HQ.
  scored: {
    Enumerate: function () {
      if (scoringFromServer == GetServer(this)) {
        var choices = ChoicesArrayCards(corp.RnD.cards, function (card) {
          return !CheckCardType(card, ["agenda"]); //only non-agenda cards permitted
        });
		//**AI code
		if (corp.AI != null) {
			//don't use this ability if R&D is getting super empty
			if (choices.length > 1) return [corp.AI._bestNonAgendaTutorOption(choices)];
		}
        choices.push({ card: null, label: "Continue", button: "Continue" }); //even if there are no non-agenda cards, you can legally search and fail  (more info here: http://ancur.wikia.com/wiki/Democracy_and_Dogma_UFAQ#Mumbad_City_Hall)
        return choices;
      }
      return [];
    },
    Resolve: function (params) {
      if (params.card !== null) {
        Shuffle(corp.RnD.cards);
        Log("R&D shuffled");
        MoveCard(params.card, corp.RnD.cards); //move it to top...just makes it easier to view during reveal
        Render(); //force the visual change
        Reveal(
          params.card,
          function () {
            Log(GetTitle(params.card) + " added to HQ"); //prevent reveal not currently implemented so title will always be known
            MoveCard(params.card, corp.HQ.cards);
          },
          this
        );
      }
    },
    text: "Search R&D for 1 non-agenda card",
  },
  RezUsability: function () {
    //only rez if a card in this server can be scored right now
    if (typeof currentPhase.Enumerate.score == "function") {
      var thisRoot = GetServer(this).root;
      var agendaInThisServer = null;
      for (var i = 0; i < thisRoot.length; i++) {
        if (CheckCardType(thisRoot[i], ["agenda"])) {
          agendaInThisServer = thisRoot[i];
          break;
        }
      }
      if (agendaInThisServer) {
        var scorables = currentPhase.Enumerate.score();
        for (var i = 0; i < scorables.length; i++) {
          if (scorables[i].card == agendaInThisServer) return true;
        }
      }
    }
    return false;
  },
};
cardSet[30067] = {
  title: "Offworld Office",
  imageFile: "30067.png",
  elo: 1822,
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Expansion"],
  agendaPoints: 2,
  advancementRequirement: 4,
  scored: {
    Resolve: function () {
      if (intended.score == this) GainCredits(corp, 7);
    },
    automatic: true,
  },
};
cardSet[30068] = {
  title: "Orbital Superiority",
  imageFile: "30068.png",
  elo: 1362,
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Security"],
  agendaPoints: 2,
  advancementRequirement: 4,
  //When you score this agenda, if the Runner is tagged, do 4 meat damage; otherwise, give the Runner 1 tag.
  scored: {
    Enumerate: function () {
      if (intended.score == this) return [{}];
      return [];
    },
    Resolve: function (params) {
      if (CheckTags(1)) MeatDamage(4);
      else AddTags(1);
    },
    text: "Do 4 meat damage or give the Runner 1 tag",
  },
};
cardSet[30069] = {
  title: "Send a Message",
  imageFile: "30069.png",
  elo: 1612,
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Security"],
  agendaPoints: 3,
  advancementRequirement: 5,
  SharedEnumerate: function (targetCard) {
    if (targetCard == this) {
      var choices = ChoicesInstalledCards(corp, function (card) {
        return CheckRez(card, ["ice"]);
      });
      if (choices.length < 1) return [];
      //**AI code (in this case, implemented by returning only the preferred option)
      else if (corp.AI != null) {
        //choose the most expensive one, taking into account server protection that exists already
		servprotmult = 0.5; //arbitrary, this mostly exists to break ties
        var mostExpensiveChoice = choices[0];
        var highestValue = -Infinity; //we're going to check all ice but this gives us a default
		//console.log("value of "+choices[0].card.title+" in "+ServerName(GetServer(choices[0].card))+" is "+highestValue);
        for (var i = 0; i < choices.length; i++) {
          var iHighestValue = RezCost(choices[i].card) - servprotmult*corp.AI._protectionScore(GetServer(choices[i].card), {});
		  //if it disables hosts it may be better to rez than other ice
		  if (choices[i].card.AIDisablesHostedPrograms) {
			  //particularly if Magnet and there are any runner cards hosted on non-disabling ice
			  if (choices[i].card.title == "Magnet") {
				  var runnerCardsHostedNotDisabled = false;
				  var installedRunnerCards = InstalledCards(runner);
				  for (var j=0; j<installedRunnerCards.length; j++) {
					  if (installedRunnerCards[j].host && !installedRunnerCards[j].host.AIDisablesHostedPrograms) {
						  runnerCardsHostedNotDisabled = true;
						  break;
					  }
				  }
				  if (runnerCardsHostedNotDisabled) iHighestValue += 1.0; //arbitrary
			  }
		  }
	      //otherwise ignore ice that has a card hosted (e.g. Tranquilizer but just a general check for now)
		  else if ( (typeof choices[i].card.hostedCards !== "undefined") && (choices[i].card.hostedCards.length > 0) ) continue;
		  //console.log("value of "+choices[i].card.title+" in "+ServerName(GetServer(choices[i].card))+" is "+iHighestValue);
          if (iHighestValue > highestValue || choices[i].card.additionalRezCostForfeitAgenda) {
            highestValue = iHighestValue;
            mostExpensiveChoice = choices[i];
          }
        }
        choices = [mostExpensiveChoice];
      } else
        choices = [
          { card: null, label: "Continue", button: "Continue" },
        ].concat(choices); //human UI
      return choices;
    }
    return [];
  },
  SharedResolve: function (params) {
    if (corp.AI == null) {
      //human corp
      if (params.card) Rez(params.card, true); //true means ignore all costs
    }
    //**AI code
    else {
      var binaryChoices = BinaryDecision(
        corp,
        "Rez 1 piece of ice",
        "Continue",
        "Send a Message",
        this,
        function () {
          Rez(params.card, true); //true means ignore all costs
        }
      );
      corp.AI._log("I know this one");
      var choice = binaryChoices[0]; //activate by default
      if (
        RezCost(params.card) < 0.3 * (Credits(corp) + 1) &&
        !params.card.knownToRunner
      )
        choice = binaryChoices[1]; //don't activate if it's not too expensive
      corp.AI.preferred = { title: "Send a Message", option: choice }; //title must match currentPhase.title for AI to fire
    }
  },
  scored: {
    //you may rez 1 installed piece of ice, ignoring all costs
    Enumerate: function () {
      return this.SharedEnumerate(intended.score);
    },
    Resolve: function (params) {
      this.SharedResolve(params);
    },
    text: "You may rez 1 installed piece of ice, ignoring all costs",
  },
  stolen: {
    //you may rez 1 installed piece of ice, ignoring all costs
    Enumerate: function () {
      return this.SharedEnumerate(intended.steal);
    },
    Resolve: function (params) {
      this.SharedResolve(params);
    },
    text: "You may rez 1 installed piece of ice, ignoring all costs",
  },
};
cardSet[30070] = {
  title: "Superconducting Hub",
  imageFile: "30070.png",
  elo: 1335,
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "agenda",
  subTypes: ["Expansion"],
  agendaPoints: 1,
  advancementRequirement: 3,
  //When you score this agenda, you may draw 2 cards.
  scored: {
    Enumerate: function () {
      if (intended.score == this) {
		  if (corp.RnD.cards.length > 1) return [{}];
	  }
      return [];
    },
    Resolve: function (params) {
      BinaryDecision(
        corp,
        "Draw 2 cards",
        "Continue",
        "Superconducting Hub",
        this,
        function () {
          Draw(corp, 2);
        }
      );
    },
    text: "You may draw 2 cards",
  },
  //You get +2 maximum hand size.
  modifyMaxHandSize: {
    Resolve: function (player) {
      if (player == corp) return 2; //+2
      return 0; //no modification to maximum hand size
    },
  },
};
cardSet[30071] = {
  title: "Regolith Mining License",
  imageFile: "30071.png",
  elo: 1629,
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "asset",
  rezCost: 2,
  trashCost: 3,
  //When you rez this asset, load 15[c] onto it. When it is empty, trash it.
  cardRezzed: {
    Resolve: function (card) {
      if (card == this) LoadCredits(this, 15);
    },
  },
  //[click]: Take 3[c] from this asset.
  abilities: [
    {
      text: "Take 3[c] from this asset.",
      Enumerate: function () {
        if (!CheckActionClicks(corp, 1)) return [];
        if (!CheckCounters(this, "credits", 3)) return []; //because it doesn't say 'take *up to* ...'
        return [{}];
      },
      Resolve: function (params) {
        SpendClicks(corp, 1);
        TakeCredits(corp, this, 3); //removes from card, adds to credit pool
        if (!CheckCounters(this, "credits", 1)) {
          Trash(this, true);
        }
      },
    },
  ],
  RezUsability: function () {
    //only rez if there will be clicks to use it (for convenience this excludes first start-of-turn window)
	if ( currentPhase.identifier.substring(0,6) != "Corp 2" || !CheckClicks(corp, 1) ) return false;
    return true;
  },
  //**AI code for installing (return -1 to not install, index in emptyProtectedRemotes to install in a specific server, or emptyProtectedRemotes.length to install in a new server)
  AIWorthInstalling: function (emptyProtectedRemotes) {
	//only install if there isn't already a Regolith installed and we're not already rich (unless installing from Archives)
    if ( ( !corp.AI._copyAlreadyInstalled(this) && !corp.AI._sufficientEconomy(false) ) || this.cardLocation == corp.archives.cards) {
        //choose the first non-scoring server (create one if necessary)
		//but allow install into completely empty non-scoring servers if no HVTs in hand
        for (var j = 0; j < emptyProtectedRemotes.length; j++) {
          if ( !corp.AI._isAScoringServer(emptyProtectedRemotes[j]) || (corp.AI._HVTsInHand() < 1 && emptyProtectedRemotes[j].root.length < 1) ) return j;
        }
        return emptyProtectedRemotes.length;
    }
    return -1; //don't install
  },
};
cardSet[30072] = {
  title: "Palisade",
  imageFile: "30072.png",
  elo: 1556,
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "ice",
  rezCost: 3,
  strength: 2,
  subTypes: ["Barrier"],
  //While this ice is protecting a remote server, it gets +2 strength.
  modifyStrength: {
    Resolve: function (card) {
      if (card == this) {
        var protecting = GetServer(card);
        for (var i = 0; i < corp.remoteServers.length; i++) {
          if (protecting == corp.remoteServers[i]) return 2; //+2
        }
      }
      return 0; //no modification to strength
    },
  },
  //subroutines:
  //End the run.
  subroutines: [
    {
      text: "End the run.",
      Resolve: function () {
        EndTheRun();
      },
      visual: { y: 88, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	result.sr = [[["endTheRun"]]];
	return result;
  },
};
cardSet[30073] = {
  title: "Tithe",
  imageFile: "30073.png",
  elo: 1512,
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "ice",
  rezCost: 1,
  strength: 1,
  subTypes: ["Sentry", "AP"],
  //subroutines:
  //Do 1 net damage.
  //Gain 1[c].
  subroutines: [
    {
      text: "Do 1 net damage.",
      Resolve: function () {
        NetDamage(1);
      },
      visual: { y: 57, h: 16 },
    },
    {
      text: "Gain 1[c].",
      Resolve: function () {
        GainCredits(corp, 1);
      },
      visual: { y: 73, h: 16 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	if (maxCorpCred > 4) {
	  //i.e. corp has lots of credits (this threshold is arbitrary)
	  result.sr = [[["netDamage"]], [["misc_minor"]]];
	} else {
	  result.sr = [[["netDamage"]], [["misc_moderate"]]];
	}
	return result;
  },
};
cardSet[30074] = {
  title: "Whitespace",
  imageFile: "30074.png",
  elo: 1579,
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "ice",
  rezCost: 2,
  strength: 0,
  subTypes: ["Code Gate"],
  //subroutines:
  //The Runner loses 3[c].
  //If the Runner has 6[c] or less, end the run.
  subroutines: [
    {
      text: "The Runner loses 3[c].",
      Resolve: function () {
        LoseCredits(runner, 3);
      },
      visual: { y: 56, h: 16 },
    },
    {
      text: "If the Runner has 6[c] or less, end the run.",
      Resolve: function () {
        if (Credits(runner) <= 6) EndTheRun(); //CheckCredits is not used here because it is a pool check not a cost
      },
      visual: { y: 80, h: 31 },
    },
  ],
  AIImplementIce: function(rc, result, maxCorpCred, incomplete) {
	result.sr = [
	  [["loseCredits", "loseCredits", "loseCredits"]], //lose 3 credits
	  [["iceSpecificEffect"],
	  ],
	  //The Runner only “has” credits in their credit pool. (Rulings)
	];
	return result;
  },
  AIIceSpecificEffect: function(poolCreditsLeft, otherCreditsLeft) {
	//if the runner has 6c or less, etr
	if (poolCreditsLeft <= 6) return ["endTheRun"];
	else return [];
  },
};
cardSet[30075] = {
  title: "Hedge Fund",
  imageFile: "30075.png",
  elo: 1888,
  player: corp,
  faction: "Neutral",
  influence: 0,
  cardType: "operation",
  subTypes: ["Transaction"],
  playCost: 5,
  Resolve: function (params) {
    GainCredits(corp, 9);
  },
};
cardSet[30076] = {
  title: "The Catalyst",
  imageFile: "30076.png",
  elo: 1159,
  player: runner,
  link: 0,
  cardType: "identity",
  subTypes: ["Natural"],
  Tutorial: function(str) {
    if ((str=="Corp Mulligan")||(str=="Runner Mulligan")) {
		if (globalProperties.agendaPointsToWin == 6) TutorialMessage("For this game we will be playing with the System Gateway starter decks.\n\nThe first player to earn 6 agenda points wins (for a normal game it would be 7 points).\n\nTo undo a decision, use Rewind in the game menu (hat button).");
		else TutorialMessage("The Corp now has these abilities:\n• @, 2$: Trash a resource (use only when Runner is tagged)\n• @@@: Purge virus counters\n\nThe Runner now has this ability:\n• @, 2$: Remove a tag");
	}
	else TutorialMessage("");
  }
};
cardSet[30077] = {
  title: "The Syndicate",
  imageFile: "30077.png",
  elo: 1205,
  player: corp,
  cardType: "identity",
  subTypes: ["Megacorp"],
};
