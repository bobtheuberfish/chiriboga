//PHASES and subphases
/**
 * Defines and responds to commands and effects
 *
 * @class Phase
 * @param {Player} player which turn this is in, corp or runner
 * @param {String} title formal phase as per rulebook
 * @param {String} identifier subphase e.g. as identified p32
 * @param {function} Init code executed at start of subphase
 * @param {function[]} checks checks for commands defined as functions
 * @param {function[]} commands commands defined as functions (in addition to defaults)
 * @param {Phase} next default subphase to follow this
 */

var phases = {};
var currentPhase = null;
function TurnPhaseStr() {
  return currentPhase.title; //+" ("+PlayerName(activePlayer)+")";//" &gt; ";
}

//**Phase templates
var phaseTemplates = {};
/**
 * Creates a new game phase based on a previously defined phase object
 *
 * @class CreatePhaseFromTemplate
 * @param {Phase} template phase to copy
 * @param {Player} player corp or runner
 * @param {String} title formal phase as per rulebook
 * @param {String} identifier subphase e.g. as identified p32
 * @param {Phase} next default subphase to follow this
 * @returns {Phase} newly created phase object
 */
function CreatePhaseFromTemplate(template, player, title, identifier, next) {
  var ret = jQuery.extend(true, {}, template);
  ret.player = player;
  ret.title = title;
  ret.identifier = identifier;
  ret.next = next;
  return ret;
}
//mulligan template
phaseTemplates.mulligan = {
  player: null,
  Resolve: {
    m: function () {
      SetHistoryThumbnail("", "Mulligan");
      Log(PlayerName(activePlayer) + " took a mulligan");
      Mulligan();
    },
    n: function () {
      SetHistoryThumbnail("", "Keep");
      Log(PlayerName(activePlayer) + " chose to keep");
      IncrementPhase();
    },
  },
};
//response template (rez/trigger/score)
//This handles the respond/decline loop because the player turn is indicated in phase.player, and activePlayer is set to this during ChangePhase
//  - http://ancur.wikia.com/wiki/Paid_Abilities_Primer
//If a player Resolves n after acting, activePlayer is toggled (no phase change)
//This template also contains some phase-specific checks to make things easier
phaseTemplates.standardResponse = {
  Init: function () {
    if (!currentPhase.lessOpportunities) opportunitiesGiven = false;
    else opportunitiesGiven = true;
    actedThisPhase = false;
    if (currentPhase.identifier == "Run 2.1") {
      //Run: Approach Ice (Nisei 2021 2.1)
      if (attackedServer.ice[approachIce].rezzed)
        SetHistoryThumbnail(attackedServer.ice[approachIce].imageFile, "");
      else
        SetHistoryThumbnail(
          "Corp_back.png",
          "Approach",
          "transform: rotate(90deg);"
        );
      UnbreakAll(attackedServer.ice[approachIce]); //subroutines start unbroken
      if (approachIce == attackedServer.ice.length - 1)
        Log(
          "Approaching outermost piece of ice protecting " +
            attackedServer.serverName
        );
      else
        Log(
          "Approaching next piece of ice protecting " +
            attackedServer.serverName
        );
      //TODO cardApproached would trigger here but not implemented yet
    } else if (currentPhase.identifier == "Run 3.1") {
      //Run: Encounter Ice (Nisei 2021 3.1)
      SetHistoryThumbnail(
        attackedServer.ice[approachIce].imageFile,
        "",
        "transform: rotate(90deg);"
      );
      Log("Encountering " + GetTitle(attackedServer.ice[approachIce], true));
      encountering = true;
      AutomaticTriggers("cardEncountered", attackedServer.ice[approachIce]);
    } else if (currentPhase.identifier == "Run 4.3") {
      //Run: Movement (Nisei 2021 4.3)
      //TODO fire triggers 'when runner passes' (Nisei 2021 4.1) this could be here or its own phase
      movement = true;
    }
  },
  Enumerate: {
    rez: function () {
      if (activePlayer == corp) {
        if (currentPhase.corpSkip) return [];
        var ret = ChoicesInstalledCards(corp, function (card) {
          var currentRezCost = RezCost(card);
          //corp can always rez upgrades and assets (except for usability)
          if (CheckRez(card, ["upgrade", "asset"])) {
            if (CheckCredits(currentRezCost, corp, "rezzing", card)) {
              if (typeof card.RezUsability == "function")
                return card.RezUsability();
              //for usability, maybe not allowed to rez
              else return true;
            }
          }
          //but only the approached (not encountered) ice
          if (CheckApproach() && approachIce < attackedServer.ice.length) {
            if (card == attackedServer.ice[approachIce]) {
              if (CheckRez(card, ["ice"]))
                return CheckCredits(currentRezCost, corp, "rezzing", card);
            }
          }
          //other cards cannot be rezzed
          return false;
        });
        return ret;
      } else return [];
    },
    trigger: function () {
      if (activePlayer == corp && currentPhase.corpSkip) return [];
      return ChoicesTriggerableAbilities(activePlayer);
    },
  },
  Resolve: {
    n: function () {
      if (activePlayer == corp && currentPhase.corpSkip)
        currentPhase.corpSkip = false;

      if (activePlayer != currentPhase.player) opportunitiesGiven = true; //each player gets at least one chance to act
      if (opportunitiesGiven && !actedThisPhase) {
        //player declined to act, phase ends
        if (currentPhase.identifier == "Run 2.2") {
          //Run: Approach paid ability window (Nisei 2021 2.2)
          if (attackedServer.ice[approachIce].rezzed) {
            ChangePhase(phases.runEncounterIce); //ice at this position is rezzed, encounter it (Nisei 2021 2.3.1)
            return;
          }
          Log("Corp did not rez ice");
          ChangePhase(phases.runDecideContinue);
          return;
        } else if (currentPhase.identifier == "Run 3.1") {
          //Run: Encounter triggers fire (Nisei 2021 3.1)
          subroutine = 0;
          ChangePhase(phases.runSubroutines); //3.1 included Nisei 3.2 runner can use paid abilities (e.g. break subroutines) so now time to fire them
          return;
        } else if (currentPhase.identifier == "Run 4.5") {
          //Run: Movement phase ends (Nisei 2021 4.6)
          movement = false;
          if (forceNextIce !== null) {
            approachIce = forceNextIce;
            forceNextIce = null;
          } else approachIce--;
          if (approachIce > -1) ChangePhase(phases.runApproachIce);
          //runners position has moved but approach triggers fire after paid ability window
          else ChangePhase(phases.runApproachServer); //by default approach server
          return;
        }
        IncrementPhase();
      } else {
        //player acted, give other player a chance to respond
        if (activePlayer == corp) activePlayer = runner;
        else activePlayer = corp;
        actedThisPhase = false;
      }
    },
    rez: function (params) {
      SpendCredits(
        corp,
        RezCost(params.card),
        "rezzing",
        params.card,
        function () {
          Rez(params.card);
          actedThisPhase = true;
        },
        this
      );
    },
    trigger: function (params) {
      /* old code
			Trigger(params.card, params.ability, params.choice);
			*/
      TriggerAbility(params.card, params.ability);
      actedThisPhase = true;
    },
  },
};

//Some response phases don't allow the corp to rez anything (these are only ever in runner turn)
phaseTemplates.noRezResponse = CreatePhaseFromTemplate(
  phaseTemplates.standardResponse,
  runner,
  "",
  "",
  null
);
phaseTemplates.noRezResponse.Enumerate.rez = function () {
  return [];
};

//corp could-score response template (rez/trigger/score)
phaseTemplates.corpScorableResponse = CreatePhaseFromTemplate(
  phaseTemplates.standardResponse,
  corp,
  "",
  "",
  null
);
phaseTemplates.corpScorableResponse.Enumerate.score = function () {
  if (activePlayer != corp) return [];
  else if (currentPhase.corpSkip) return [];

  var ret = [];
  //for each remote server...
  for (var i = 0; i < corp.remoteServers.length; i++) {
    //for each installed agenda...
    for (var j = 0; j < corp.remoteServers[i].root.length; j++) {
      //if can score (advancement requirement met, not forbidden, etc), add to ret
      var thecard = corp.remoteServers[i].root[j];
      if (CheckScore(thecard))
        ret.push({ card: thecard, label: GetTitle(thecard, true) });
    }
  }
  return ret;
};
phaseTemplates.corpScorableResponse.Resolve.score = function (params) {
  SetHistoryThumbnail(params.card.imageFile, "Score");
  Score(params.card);
};
//discard template
phaseTemplates.discardStart = {
  Enumerate: {
    n: function () {
      var discardDownTo = MaxHandSize(activePlayer);
      if (discardDownTo < 0) discardDownTo = 0;
      if (ActivePlayerHand().length > discardDownTo) return [];
      else return [{}];
    },
    discard: function () {
      var discardDownTo = MaxHandSize(activePlayer);
      if (discardDownTo < 0) discardDownTo = 0;
      if (ActivePlayerHand().length > discardDownTo) {
        var ret = ChoicesHandCards(activePlayer);
        return ret;
      } else return [];
    },
  },
  Resolve: {
    n: function () {
      if (activePlayer == runner) {
        if (MaxHandSize(runner) < 0) {
          //if runner has a maximum hand size of less than zero at the end of his turn, then he is flatlined and the Corporation wins the game.
          PlayerWin(corp, "Runner flatlined");
          return;
        }
      }
      IncrementPhase();
    },
    discard: function (params) {
      Discard(params.card);
    },
  },
};
//subutility for GlobalTriggersPhaseCommonResolveN
function BuildGlobalTriggerList() {
  currentPhase.triggerList = [];
  var triggerName = currentPhase.triggerCallbackName;
  var initialList = ChoicesActiveTriggers(triggerName, activePlayer);
  //immediately activate automatic ones and remove from list
  for (var i = 0; i < initialList.length; i++) {
    if (initialList[i].card[triggerName].automatic) {
      if (typeof initialList[i].card[triggerName].Enumerate == "function")
        LogError(
          "." +
            triggerName +
            ".Enumerate on " +
            GetTitle(initialList[i].card) +
            " will be ignored because it is set to automatic (consider moving the checks into .Resolve)"
        );
      var oldPhase = currentPhase;
      initialList[i].card[triggerName].Resolve.call(initialList[i].card);
      //phase shouldn't change during automatic triggers
      if (oldPhase !== currentPhase) {
        LogError(
          "." +
            triggerName +
            " on " +
            GetTitle(initialList[i].card) +
            " should not be automatic"
        );
        //and avoid crash by moving the trigger to the proper list (this is not expected to behave properly)
        currentPhase = oldPhase;
        currentPhase.triggerList.push(initialList[i]);
      }
    } else {
      currentPhase.triggerList.push(initialList[i]);
    }
  }
}
//phase utility for phaseTemplates.globalTriggers
function GlobalTriggersPhaseCommonResolveN(
  skipInit,
  afterOpportunity,
  context
) {
  //afterOpportunity is called after BOTH players are done
  //if only the first player's triggers have resolved, switch active player and resolve theirs
  if (currentPhase.player == playerTurn) {
    //swap player
    if (currentPhase.player == corp) currentPhase.player = runner;
    else currentPhase.player = corp;
    activePlayer = currentPhase.player;
    //rebuild trigger list
    BuildGlobalTriggerList();
  }
  //both players triggers have been resolved, finish this pseudophase
  else {
    //now move to next phase (or return to previous)
    IncrementPhase(skipInit);
    if (typeof afterOpportunity === "function") afterOpportunity.call(context);
  }
}

//template for phases which trigger simultaneously on any number of cards
//first the player whose turn it is, then the other player
//NOTE: triggerCallbackName must be set
phaseTemplates.globalTriggers = {
  triggerList: [],
  triggerCallbackName: "NOT SET",
  Init: function () {
    //follow priority rules
    //https://ancur.fandom.com/wiki/Timing_Priority
    activePlayer = currentPhase.player = playerTurn;

    //if start of turn, replenish recurring credits
    if (
      currentPhase.identifier == "Corp 1.2" ||
      currentPhase.identifier == "Runner 1.2"
    ) {
      ApplyToAllActiveCards(function (card) {
        if (typeof card.recurringCredits !== "undefined")
          card.credits = card.recurringCredits;
      }, currentPhase.player);
	  //AI keeps track of how many turns (each player's turn counts as 1) a card (agenda/asset/upgrade) has been installed a server
	  for (var i=0; i<corp.remoteServers.length; i++) {
		for (var j=0; j<corp.remoteServers[i].root.length; j++) {
          if (typeof corp.remoteServers[i].root[j].AITurnsInstalled !== "undefined")
            corp.remoteServers[i].root[j].AITurnsInstalled++;
          else corp.remoteServers[i].root[j].AITurnsInstalled = 1;
		}
	  }
	  //log some stuff for debugging purposes (console/captured only, not to history bar)
	  console.log("SPOILER: At start of "+currentPhase.identifier.substring(0,currentPhase.identifier.length-4)+" turn:");
	  console.log("SPOILER: Corp has "+corp.creditPool+" credit(s) and "+corp.HQ.cards.length+" card(s) in hand: "+JSON.stringify(corp.HQ.cards));
	  console.log("SPOILER: Runner has "+runner.creditPool+" credit(s), "+runner.tags+" tag(s) and "+runner.grip.length+" card(s) in hand: "+JSON.stringify(runner.grip));
    }
    //end of encounter needs to...end the encounter
    if (currentPhase.identifier == "Run EncounterEnd") encountering = false;
    //log approach to server
    if (currentPhase.identifier == "Run 4.6.2") {
      Log("Approaching " + attackedServer.serverName);
      approachIce = -1;
    }
    //log successful run
    if (currentPhase.identifier == "Run 5.1") {
      Log("Run successful");
      //store a little extra info to help AIs with decisionmaking
      if (
        typeof attackedServer.cards !== "undefined" ||
        attackedServer.root.length > 0
      ) {
        //ignore random runs on empty remotes
        if (typeof attackedServer.AISuccessfulRuns !== "undefined")
          attackedServer.AISuccessfulRuns++;
        else attackedServer.AISuccessfulRuns = 1;
      }
    }

    //build trigger list
    BuildGlobalTriggerList();
  },
  Enumerate: {
    trigger: function () {
      return ValidateTriggerList(
        currentPhase.triggerList,
        currentPhase.triggerCallbackName
      );
    },
    n: function () {
      if (
        ValidateTriggerList(
          currentPhase.triggerList,
          currentPhase.triggerCallbackName
        ).length < 1
      )
        return [{}];
      return [];
    },
  },
  Resolve: {
    trigger: function (params) {
      var card = params.card;
      var triggerCallback = card[currentPhase.triggerCallbackName];
      currentPhase.triggerList.splice(params.id, 1); //remove from triggers list (only trigger once)
      var instruction = GetTitle(card, true);
      if (typeof triggerCallback.text !== "undefined")
        instruction = triggerCallback.text;
      else instruction = GetTitle(card, true);
      var choices = [{}]; //assume valid by default
      if (typeof triggerCallback.Enumerate === "function")
        choices = triggerCallback.Enumerate.call(card);
      //DecisionPhase(card.player,choices,triggerCallback.Resolve,"Triggering '"+currentPhase.triggerCallbackName+"' on "+GetTitle(card,true),instruction,card);
      DecisionPhase(
        card.player,
        choices,
        triggerCallback.Resolve,
        instruction,
        instruction,
        card
      );
    },
    n: function () {
      GlobalTriggersPhaseCommonResolveN();
    },
  },
  text: {},
  chosenString: "triggered",
};

function CombineResponseWithPhase(
  responsePhase,
  combineWith,
  nextIfException,
  nextIfCombine,
  exceptionCondition,
  disallowCombinedN = true
) {
  responsePhase.backup = {};
  responsePhase.backupStored = false;
  responsePhase.combineWith = combineWith;
  responsePhase.exceptionCondition = exceptionCondition;
  responsePhase.preEnumerate = function () {
    //since this is post-action, this is also where we clean up any resolving cards that still remain
    while (corp.resolvingCards.length > 0) {
      MoveCard(corp.resolvingCards[0], corp.archives.cards);
    }

    //check whether we can use a combined phase (see below)
    var combineResponse = false;
    //console.log(ChoicesTriggerableAbilities(runner));
    if (corp.AI == null)
      combineResponse = ChoicesTriggerableAbilities(runner).length == 0; //i.e. whether runner has potential actions - corp needs to decide whether to respond

    if (exceptionCondition()) {
      //e.g. if out of clicks, time to move on, or need to discard, can't skip that phase
      currentPhase.next = nextIfException;
      combineResponse = false;
    } else {
      if (combineResponse) currentPhase.next = nextIfCombine;
      else currentPhase.next = combineWith;
    }

    //special things to simplify UI when playing as Corp
    //specifically, we add the properties of currentPhase.combineWith into currentPhase
    //a more simple approach would be to use a pre-created phase for this - but then anything that modified either phase wouldn't affect it
    if (corp.AI == null) {
      if (combineResponse) {
        //if the current phase has not yet been backed up, store any properties that will be overwritten
        //do this by iterating through currentPhase.combineWith and storing currentPhases's property, if defined
        if (!currentPhase.backupStored) {
          for (prop in currentPhase.combineWith) {
            if (typeof currentPhase[prop] !== "undefined") {
              if (prop == "Enumerate" || prop == "Resolve" || prop == "text") {
                //iterate these at sub-level
                currentPhase.backup[prop] = {}; //we need a fresh copy so we don't modify them in the original phase
                for (subprop in currentPhase.combineWith[prop]) {
                  if (subprop != "trigger") {
                    //for trigger, keep original function i.e. don't limit to click abilities
                    if (typeof currentPhase[prop][subprop] !== "undefined") {
                      //needs to be backed up
                      currentPhase.backup[prop][subprop] =
                        currentPhase[prop][subprop];
                    }
                  }
                }
              } else if (prop != "next") {
                //don't modify this, allow it to be set above
                if (typeof currentPhase[prop] !== "undefined") {
                  //needs to be backed up
                  currentPhase.backup[prop] = currentPhase[prop];
                }
              }
            }
          }
        }

        //now copy properties from currentPhase.combineWith into currentPhase
        for (prop in currentPhase.combineWith) {
          if (prop == "Enumerate" || prop == "Resolve" || prop == "text") {
            //iterate these at sub-level
            if (typeof currentPhase[prop] == "undefined")
              currentPhase[prop] = {};
            for (subprop in currentPhase.combineWith[prop]) {
              if (subprop != "trigger") {
                //for trigger, keep original function i.e. don't limit to click abilities
                currentPhase[prop][subprop] =
                  currentPhase.combineWith[prop][subprop];
              }
            }
          } else if (prop != "next") {
            //don't modify this, allow it to be set above
            currentPhase[prop] = currentPhase.combineWith[prop];
          }
        }

        if (disallowCombinedN)
          currentPhase.Enumerate.n = function () {
            return [];
          };
        currentPhase.backupStored = true;
        executingCommand = "n"; //we are not mid-action
      } //not combineResponse
      else {
        //if the current phase has a stored backup, restore any properties
        //and delete properties that are not present in the backup
        if (currentPhase.backupStored) {
          //if a backup has been stored, restore from it
          if (currentPhase.backupStored) {
            for (prop in currentPhase.combineWith) {
              if (typeof currentPhase.backup[prop] !== "undefined") {
                //exists in backup, we will copy from it
                if (
                  prop == "Enumerate" ||
                  prop == "Resolve" ||
                  prop == "text"
                ) {
                  //iterate these at sub-level
                  for (subprop in currentPhase.combineWith[prop]) {
                    if (subprop != "trigger") {
                      //for trigger, keep original function i.e. don't limit to click abilities
                      if (
                        typeof currentPhase.backup[prop][subprop] !==
                        "undefined"
                      )
                        currentPhase[prop][subprop] =
                          currentPhase.backup[prop][subprop];
                      else delete currentPhase[prop][subprop]; //wasn't backed up so it should be removed
                    }
                  }
                }
              } else if (prop != "next") {
                //next wasn't backed up but should be left alone
                delete currentPhase[prop]; //wasn't backed up so it should be removed
              }
            }
          }
        }

        if (disallowCombinedN)
          currentPhase.Enumerate.n = function () {
            return [{}];
          };
      }
    }
  };
}

//ACTUAL PHASES IMPLEMENTATION BELOW (templates above)

//Corp Mulligan
phases.corpMulligan = CreatePhaseFromTemplate(
  phaseTemplates.mulligan,
  corp,
  "Corporation's Mulligan",
  "Corp Mulligan",
  null
);
phases.corpMulligan.historyBreak = {
  title: "Corporation's Mulligan",
  style: "small",
};

//Runner Mulligan
phases.runnerMulligan = CreatePhaseFromTemplate(
  phaseTemplates.mulligan,
  runner,
  "Runner's Mulligan",
  "Runner Mulligan",
  null
);
phases.runnerMulligan.historyBreak = {
  title: "Runner's Mulligan",
  style: "small",
};

//Start of Draw Phase
phases.corpStartDraw = CreatePhaseFromTemplate(
  phaseTemplates.corpScorableResponse,
  corp,
  "Corporation's Draw Phase",
  "Corp 1.1",
  null
);
phases.corpStartDraw.historyBreak = {
  title: "Corporation's Turn Begins",
  style: "small",
};

//"When your turn begins" conditionals meet their trigger conditions
phases.corpTurnBegin = CreatePhaseFromTemplate(
  phaseTemplates.globalTriggers,
  corp,
  "Corporation's Turn Begins",
  "Corp 1.2",
  null
);
phases.corpTurnBegin.triggerCallbackName = "corpTurnBegin";

//End of Draw Phase
phases.corpEndDraw = {
  player: corp,
  title: "Corporation's Draw Phase",
  identifier: "Corp 1.3",
  Init: function () {
    SetHistoryThumbnail("Corp_back.png", "Draw");
    Draw(corp, 1);
  }, //auto-draw
  Resolve: {
    n: function () {
      IncrementPhase();
    },
  },
};

//Start of Action Phase
phases.corpActionStart = CreatePhaseFromTemplate(
  phaseTemplates.corpScorableResponse,
  corp,
  "Corporation's Action Phase",
  "Corp 2.1",
  null
);
phases.corpActionStart.Init = function () {
  ResetClicks();
};

//Take action (should only ever be here if there is at least one click remaining, but CheckActionClicks(corp,1) just in case)
phases.corpActionMain = {
  player: corp,
  title: "Corporation's Action Phase",
  identifier: "Corp 2.2",
  Enumerate: {
    install: function () {
      if (CheckActionClicks(corp, 1)) {
        var ret = ChoicesHandInstall(corp);
        return ret;
      } else return [];
    },
    play: function () {
      var ret = [];
      var hand = PlayerHand(corp);
      for (var i = 0; i < hand.length; i++) {
        var card = hand[i];
        if (FullCheckPlay(card))
          ret.push({ card: card, label: GetTitle(card, true) });
      }
      return ret;
    },
    advance: function () {
      var ret = [];
      if (CheckActionClicks(corp, 1)) {
        var possibleAdvance = ChoicesInstalledCards(corp, CheckAdvance);
        for (var i = 0; i < possibleAdvance.length; i++) {
          if (CheckCredits(1, corp, "advancing", possibleAdvance[i].card)) {
            //for usability, don't overadvance
            var allowAdvance = true;
            if (
              typeof possibleAdvance[i].card.advancementRequirement !==
              "undefined"
            ) {
              if (
                Counters(possibleAdvance[i].card, "advancement") >=
                possibleAdvance[i].card.advancementRequirement
              )
                allowAdvance = false;
            }
            if (
              typeof possibleAdvance[i].card.AIAdvancementLimit == "function"
            ) {
              if (
                Counters(possibleAdvance[i].card, "advancement") >=
                possibleAdvance[i].card.AIAdvancementLimit()
              )
                allowAdvance = false;
            }
            if (allowAdvance) ret.push(possibleAdvance[i]);
          }
        }
      }
      return ret;
    },
    trash: function () {
      var ret = [];
      if (CheckTags(1)) {
        if (CheckActionClicks(corp, 1)) {
          for (var i = 0; i < runner.rig.resources.length; i++) {
            var card = runner.rig.resources[i];
            if (CheckTrash(card)) {
              if (CheckCredits(2, corp, "trashing", card))
                ret.push({ card: card, label: GetTitle(card, true) });
            }
          }
        }
      }
      return ret;
    },
    trigger: function () {
      return ChoicesTriggerableAbilities(corp, "click"); //click abilities only
    },
    purge: function () {
      if (CheckActionClicks(corp, 3)) {
        if (CheckPurge()) return [{}];
      }
      return [];
    },
  },
  Resolve: {
    draw: function () {
      SetHistoryThumbnail("Corp_back.png", "Draw");
      BasicActionDraw(corp);
      IncrementPhase();
    },
    gain: function () {
      SetHistoryThumbnail("credit.png", "Gain");
      SpendClicks(corp, 1);
      GainCredits(corp, 1);
      IncrementPhase();
    },
    install: function (params) {
      Install(
        params.card,
        params.server,
        false,
        null,
        false,
        function () {
          SetHistoryThumbnail("Corp_back.png", "Install");
          SpendClicks(corp, 1);
        },
        this
      );
    },
    play: function (params) {
      Play(
        params.card,
        function () {
          SetHistoryThumbnail(params.card.imageFile, "Play");
          SpendClicks(corp, 1);
          SpendCredits(
            corp,
            params.card.playCost,
            "playing",
            params.card,
            function () {
              IncrementPhase(); //set new phase first in case card play changes phase
            },
            this
          );
        },
        this
      );
    },
    advance: function (params) {
      SetHistoryThumbnail("Corp_back.png", "Advance");
      SpendClicks(corp, 1);
      SpendCredits(
        corp,
        1,
        "advancing",
        params.card,
        function () {
          IncrementPhase();
          Advance(params.card);
        },
        this
      );
    },
    trash: function (params) {
      SetHistoryThumbnail(params.card.imageFile, "Trash");
      SpendClicks(corp, 1);
      SpendCredits(
        corp,
        2,
        "trashing",
        params.card,
        function () {
          IncrementPhase(); //set new phase first since trash true uses a pseudophase
          Trash(params.card, true);
        },
        this
      );
    },
    trigger: function (params) {
      TriggerAbility(
        params.card,
        params.ability,
        function () {
          SetHistoryThumbnail(params.card.imageFile, "Use");
          IncrementPhase(); //set new phase first in case ability trigger changes phase
        },
        this
      );
    },
    purge: function () {
      SetHistoryThumbnail("generic_red.png", "Purge");
      SpendClicks(corp, 3);
      IncrementPhase();
      Purge();
    },
  },
  text: {
    draw: "[click]: Draw a card",
    gain: "[click]: Gain one credit",
    install: "[click]: Install an agenda, asset, upgrade or ice",
    play: "[click]: Play an operation",
    advance: "[click], 1[c]: Advance a card",
    trash: "[click], 2[c]: Trash a resource",
    trigger: "Trigger a [click] ability",
    purge: "[click],[click],[click]: Purge virus counters",
  },
};
phases.corpActionMain.historyBreak = {
  title: "Corporation's Action Phase",
  style: "large",
};

//After each action
phases.corpPostAction = CreatePhaseFromTemplate(
  phaseTemplates.corpScorableResponse,
  corp,
  "Corporation's Action Phase",
  "Corp 2.2*",
  null
);

//Start of Discard Phase
phases.corpDiscardStart = CreatePhaseFromTemplate(
  phaseTemplates.discardStart,
  corp,
  "Corporation's Discard Phase",
  "Corp 3.1",
  null
);
phases.corpDiscardStart.historyBreak = {
  title: "Corporation's Turn Ends",
  style: "small",
};

//Response part of Discard Phase
phases.corpDiscardResponse = CreatePhaseFromTemplate(
  phaseTemplates.standardResponse,
  corp,
  "Corporation's Discard Phase: Response",
  "Corp 3.2",
  null
);

//"When your discard phase ends" conditionals meet their trigger conditions
phases.corpEndOfTurn = CreatePhaseFromTemplate(
  phaseTemplates.globalTriggers,
  corp,
  "Corporation's Discard Phase",
  "Corp 3.3",
  null
);
phases.corpEndOfTurn.triggerCallbackName = "corpDiscardEnds";

//First response part of Runner's Action Phase (analagous to start of Corp's draw phase)
phases.runnerStartResponse = CreatePhaseFromTemplate(
  phaseTemplates.standardResponse,
  runner,
  "Runner's Turn Begins",
  "Runner 1.1",
  null
);
phases.runnerStartResponse.Init = function () {
  ResetClicks();
};
phases.runnerStartResponse.historyBreak = {
  title: "Runner's Turn Begins",
  style: "small",
};

//"When your turn begins" conditionals meet their trigger conditions
phases.runnerTurnBegin = CreatePhaseFromTemplate(
  phaseTemplates.globalTriggers,
  runner,
  "Runner's Turn Begins",
  "Runner 1.2",
  null
);
phases.runnerTurnBegin.triggerCallbackName = "runnerTurnBegin";

//Take action (should only ever be here if there is at least one click remaining)
phases.runnerActionMain = {
  player: runner,
  title: "Runner's Action Phase",
  identifier: "Runner 1.3",
  Enumerate: {
    draw: function () {
      if (runner.stack.length < 1) return [];
      return [{}];
    },
    install: function () {
      if (CheckActionClicks(runner, 1)) {
        var choicesHandInstall = ChoicesHandInstall(runner);
        return choicesHandInstall;
      } else return [];
    },
    play: function () {
      var ret = [];
      var hand = PlayerHand(runner);
      for (var i = 0; i < hand.length; i++) {
        var card = hand[i];
        if (FullCheckPlay(card))
          ret.push({ card: card, label: GetTitle(card, true) });
      }
      return ret;
    },
    remove: function () {
      if (CheckTags(1)) {
        if (CheckActionClicks(runner, 1)) {
          if (CheckCredits(2, runner, "removing tags")) return [{}];
        }
      }
      return [];
    },
    run: function () {
      if (CheckActionClicks(runner, 1)) return ChoicesExistingServers();
      return [];
    },
    trigger: function () {
      return ChoicesTriggerableAbilities(runner, "click"); //click abilities only
    },
  },
  Cancel: {
    run: function () {
      Cancel();
    },
  },
  Resolve: {
    draw: function () {
      SetHistoryThumbnail("Runner_back.png", "Draw");
      BasicActionDraw(runner);
      IncrementPhase();
    },
    gain: function () {
      SetHistoryThumbnail("credit.png", "Gain");
      SpendClicks(runner, 1);
      GainCredits(runner, 1);
      IncrementPhase();
    },
    install: function (params) {
      Install(
        params.card,
        params.host,
        false,
        null,
        false,
        function () {
          SetHistoryThumbnail(params.card.imageFile, "Install");
          SpendClicks(runner, 1);
        },
        this
      );
    },
    play: function (params) {
      Play(
        params.card,
        function () {
          SetHistoryThumbnail(params.card.imageFile, "Play");
          SpendClicks(runner, 1);
          SpendCredits(
            runner,
            params.card.playCost,
            "playing",
            params.card,
            function () {
              IncrementPhase(); //set new phase first in case card play changes phase
            },
            this
          );
        },
        this
      );
    },
    remove: function () {
      SetHistoryThumbnail("tag.png", "Remove");
      SpendClicks(runner, 1);
      SpendCredits(
        runner,
        2,
        "removing tags",
        null,
        function () {
          IncrementPhase();
          RemoveTags(1);
        },
        this
      );
    },
    run: function (params) {
      SetHistoryThumbnail("", "Run");
      SpendClicks(runner, 1);
      UpdateCounters(); //so the used click shows as used
      MakeRun(params.server);
    },
    trigger: function (params) {
      TriggerAbility(
        params.card,
        params.ability,
        function () {
          SetHistoryThumbnail(params.card.imageFile, "Use");
          IncrementPhase(); //set new phase first in case ability trigger changes phase
        },
        this
      );
    },
  },
  text: {
    draw: "[click]: Draw a card",
    gain: "[click]: Gain one credit",
    install: "[click]: Install a program, resource, or hardware",
    play: "[click]: Play an event",
    advance: "[click], 2[c]: Remove a tag",
    run: "[click]: Make a run",
    trigger: "Trigger a [click] ability",
  },
};
phases.runnerActionMain.historyBreak = {
  title: "Runner's Action Phase",
  style: "large",
};

//Run step numbers are from NISEI Comprehensive Rules v1.5
//For now you could start thinking about it here: https://nisei.net/blog/quick-notes-comprehensive-rules-1-5/
//Run: approach ice (the template actually contains some specific checks for Run 2.1) (Nisei 2021 2.1)
phases.runApproachIce = CreatePhaseFromTemplate(
  phaseTemplates.noRezResponse,
  runner,
  "Run: Approach Ice",
  "Run 2.1",
  null
);
phases.runApproachIce.historyBreak = { title: "Run: Ice", style: "run" };

//Run: rez approached ice (the standardResponse template actually contains a specific check for Run 2.2) (Nisei 2021 2.2)
phases.runRezApproachedIce = CreatePhaseFromTemplate(
  phaseTemplates.standardResponse,
  corp,
  "Run: Rez Approached Ice",
  "Run 2.2",
  null
);
phases.runRezApproachedIce.lessOpportunities = true; //this phase is sort of treated like a corp response to previous phase

//Run: encounter ice (the template actually contains some specific checks for Run 3.1) (Nisei 2021 3.1)
phases.runEncounterIce = CreatePhaseFromTemplate(
  phaseTemplates.noRezResponse,
  runner,
  "Run: Encounter Ice",
  "Run 3.1",
  null
);

//Run: resolve subroutines (Nisei 2021 3.3)
phases.runSubroutines = {
  player: corp,
  title: "Run: Subroutines",
  identifier: "Run Subroutines",
  Init: function () {
    if (approachIce > attackedServer.ice.length - 1) subroutine = -1;
    //if ice was trashed, any remaining subroutines won't fire
    else {
      var approachedIce = attackedServer.ice[approachIce];
      if (typeof approachedIce.subroutines === "undefined") {
        LogError(
          GetTitle(approachedIce) +
            " subroutines undefined (needs to at least be empty)"
        );
        subroutine = -1;
      }
    }
  },
  Enumerate: {
    trigger: function () {
      if (approachIce >= attackedServer.ice.length) subroutine = -1; //e.g. data mine trashes itself
      if (subroutine < 0) return [];
      var approachedIce = attackedServer.ice[approachIce];
      //loop through skipping broken subroutines
      for (; subroutine < approachedIce.subroutines.length; subroutine++) {
        //non-broken subroutine? trigger and resolve.
        if (!approachedIce.subroutines[subroutine].broken) {
          var triggeredSubroutine = approachedIce.subroutines[subroutine];
          var ret = [
            { card: approachedIce, ability: triggeredSubroutine, choice: null },
          ]; //subroutines fire even if there are no choices to be made
          if (typeof triggeredSubroutine.Enumerate === "function") {
            choices = triggeredSubroutine.Enumerate.call(approachedIce);
            if (choices.length > 0) {
              ret = [];
              for (var i = 0; i < choices.length; i++) {
                ret.push({
                  card: approachedIce,
                  ability: triggeredSubroutine,
                  choice: choices[i],
                  label: choices[i].label,
                });
              }
              return ret;
            }
          } else return ret;
        }
        //to get to here would require enumerating returned no valid options. this subroutine will be skipped
      }
      return []; //no unbroken subroutines left
    },
    n: function () {
      //valid whenever trigger isn't (all subroutines must be checked)
      if (phases.runSubroutines.Enumerate.trigger().length == 0) return [{}];
      else return [];
    },
  },
  Resolve: {
    trigger: function (params) {
      Trigger(params.card, params.ability, params.choice, "Firing");
      //note: the below code is immediately executed, even if the Trigger involves pseudophases...
      subroutine++;
      if (
        currentPhase == phases.runUnsuccessful ||
        currentPhase == phases.runDecideContinue
      )
        this.n(); //some things need finishing up if run has been ended or sent to approach a different ice
    },
    n: function () {
      subroutine = -1;
      if (currentPhase.identifier == "Run Subroutines") {
        //phase hasn't been changed by external force, need to choose it here:
        //subroutines done; approach next ice or continue run (no need to check for run end because EndTheRun calls ChangePhase)
        ChangePhase(phases.runDecideContinue); //approachIce will be decremented if runner continues
      }
      //move to 'encounter ends' pseudo phase
      phases.runEncounterEnd.next = currentPhase;
      ChangePhase(phases.runEncounterEnd);
    },
  },
};

//Run: end of encounter (Nisei 2021 3.4)
phases.runEncounterEnd = CreatePhaseFromTemplate(
  phaseTemplates.globalTriggers,
  runner,
  "Run: End of Encounter",
  "Run EncounterEnd",
  null
);
phases.runEncounterEnd.triggerCallbackName = "encounterEnds";

//Run: decide whether to continue the run (Nisei 2021 4.3) this is part of the Movement Phase
phases.runDecideContinue = CreatePhaseFromTemplate(
  phaseTemplates.noRezResponse,
  runner,
  "Run: Movement",
  "Run 4.3",
  null
);
phases.runDecideContinue.Enumerate.jack = function () {
  if (activePlayer == corp) return [];
  else return [{}];
};
phases.runDecideContinue.Resolve.jack = function () {
  JackOut();
}; //the opposite, i.e. n, is runner is not jacking out, continue run (Nisei 2021 4.4)

//Run: response before approach (Nisei 2021 4.5)
phases.runResponseBeforeApproach = CreatePhaseFromTemplate(
  phaseTemplates.standardResponse,
  corp,
  "Run: Movement",
  "Run 4.5",
  null
);
phases.runResponseBeforeApproach.lessOpportunities = true; //this phase is sort of treated like a corp response to previous phase

//Run: approach server ('approaches server' triggers fire) (Nisei 2021 4.6.2)
phases.runApproachServer = CreatePhaseFromTemplate(
  phaseTemplates.globalTriggers,
  runner,
  "Run: Approach Server",
  "Run 4.6.2",
  null
);
phases.runApproachServer.triggerCallbackName = "approachServer";
phases.runApproachServer.historyBreak = { title: "Run: Server", style: "run" };

//Run: run successful (Nisei 2021 5.1)
phases.runSuccessful = CreatePhaseFromTemplate(
  phaseTemplates.globalTriggers,
  runner,
  "Run: Successful",
  "Run 5.1",
  null
);
phases.runSuccessful.triggerCallbackName = "runSuccessful";
phases.runSuccessful.text.n = "Breach";

//Run: runner breaches server to access cards from accessList (Nisei 2021 5.2)
phases.runBreachServer = {
  player: runner,
  title: "Run: Breach", //was 'Access' (i.e. access cards in server) but Nisei changed it so it's not confused with each individual access
  identifier: "Run 5.2",
  Init: function () {
    //trigger breach modifiers (number of additional cards to access)
    var additionalToAccess = ModifyingTriggers("breachServer", null, 0); //null means no parameter is sent, lower limit of 0 means the total will not be any lower than zero
    CreateAccessCardList(additionalToAccess);
    PrepareAccessList();
  },
  Enumerate: {
    access: function () {
      return ChoicesAccess();
    },
    n: function () {
      if (accessList.length < 1) return [{}];
      return [];
    },
  },
  Resolve: {
    access: function (params) {
      accessingCard = params.card;
      IncrementPhase();
    },
    n: function () {
      ChangePhase(phases.runEnds);
    },
  },
  chosenString: "accessed",
};

//Run: accessing a card (not a separate Nisei 2021 phase)
phases.runAccessingCard = {
  player: runner,
  requireHumanInput: true,
  title: "Run: Access",
  identifier: "Run Accessing",
  Init: function () {
    if (viewingPlayer == runner) {
      accessingCard.renderer.canView = true;
      SetHistoryThumbnail(accessingCard.imageFile, "Access");
    } else SetHistoryThumbnail("Corp_back.png", "Access");
    accessingCard.renderer.ToggleZoom();

    AutomaticTriggers("cardAccessed", accessingCard); //special case in CheckCallback allows for this to work even when card not active
    this.chosenString = "chosen";
    //since archived cards are already face up we can skip the flip-and-look-on-access step
    if (attackedServer == corp.archives) this.requireHumanInput = false;
    else this.requireHumanInput = true;
  },
  Enumerate: {
    trash: function () {
      if (CheckTrash(accessingCard)) {
        if (typeof accessingCard.trashCost != "undefined") {
          if (
            CheckCredits(
              accessingCard.trashCost,
              runner,
              "trashing",
              accessingCard
            )
          )
            return [{}];
        }
      }
      return [];
    },
    steal: function () {
      if (CheckSteal()) return [{}];
      return [];
    },
    trigger: function () {
      return ChoicesTriggerableAbilities(runner, "access"); //access abilities only
    },
    n: function () {
      if (CheckSteal()) return [];
      return [{}];
    },
  },
  Resolve: {
    trash: function () {
      SpendCredits(
        runner,
        accessingCard.trashCost,
        "trashing",
        accessingCard,
        function () {
          TrashAccessedCard(true); //true means it can be prevented (it is not a cost)
        },
        this
      );
    },
    steal: function () {
      SetHistoryThumbnail(accessingCard.imageFile, "Steal");
      Steal();
    },
    trigger: function (params) {
      TriggerAbility(params.card, params.ability);
    },
    n: function () {
      ResolveAccess(accessingCard.cardLocation);
    },
  },
};

//Run: run unsuccessful (Nisei 2021 6.3)
phases.runUnsuccessful = CreatePhaseFromTemplate(
  phaseTemplates.globalTriggers,
  runner,
  "Run: Unsuccessful",
  "Run 6.3",
  null
);
phases.runUnsuccessful.triggerCallbackName = "runUnsuccessful";

//Run: run ends (Nisei 2021 6.4) aka run is complete. TODO runner should lose bad pub credits at 6.2, before run is declared unsuccsessful
phases.runEnds = CreatePhaseFromTemplate(
  phaseTemplates.globalTriggers,
  runner,
  "Run: End",
  "Run 6.4",
  null
);
phases.runEnds.triggerCallbackName = "runEnds";
phases.runEnds.Resolve.n = function () {
  GlobalTriggersPhaseCommonResolveN(false, function () {
    //the false means move to next phase after resolving
    if (runner.temporaryCredits > 0)
      Log(
        "Runner loses " + runner.temporaryCredits + " unspent temporary credits"
      );
    runner.temporaryCredits = 0;
    attackedServer = null;
    approachIce = -1;
    encountering = false;
    movement = false;
    UnbreakAll(null); //for visual history we've left subroutines broken until now. let's reset them all
  });
};

//After each action
phases.runnerPostAction = CreatePhaseFromTemplate(
  phaseTemplates.standardResponse,
  runner,
  "Runner's Action Phase: Post Action",
  "Runner 1.3*",
  null
);
phases.runnerPostAction.Enumerate.n = function () {
  //since this is post-action, this is also where we clean up any resolving cards that still remain
  while (runner.resolvingCards.length > 0) {
    MoveCard(runner.resolvingCards[0], runner.heap);
  }
  return [{}];
};
phases.runnerPostAction.Resolve.n = function () {
  if (runner.clickTracker < 1) {
    ChangePhase(phases.runnerDiscardStart);
  } else IncrementPhase();
}; //if out of clicks, time to move on

//Start of Discard Phase
phases.runnerDiscardStart = CreatePhaseFromTemplate(
  phaseTemplates.discardStart,
  runner,
  "Runner's Discard Phase",
  "Runner 2.1",
  null
);
phases.runnerDiscardStart.historyBreak = {
  title: "Runner's Turn Ends",
  style: "small",
};

//Response part of Discard Phase
phases.runnerDiscardResponse = CreatePhaseFromTemplate(
  phaseTemplates.standardResponse,
  runner,
  "Runner's Discard Phase",
  "Runner 2.2",
  null
);

//"When your discard phase ends" conditionals meet their trigger conditions
phases.runnerEndOfTurn = CreatePhaseFromTemplate(
  phaseTemplates.globalTriggers,
  runner,
  "Runner's Discard Phase",
  "Runner 2.3",
  null
);
phases.runnerEndOfTurn.triggerCallbackName = "runnerDiscardEnds";

//Now that the phases are defined we can assign their default next phases
//Comment beside refers to the original phase object not the next
//Mulligans
phases.corpMulligan.next = phases.runnerMulligan; //"Corp Mulligan"
phases.runnerMulligan.next = phases.corpStartDraw; //"Runner Mulligan"
//Corp turn
phases.corpStartDraw.next = phases.corpTurnBegin; //"Corp 1.1"
phases.corpTurnBegin.next = phases.corpEndDraw; //"Corp 1.2"
phases.corpEndDraw.next = phases.corpActionStart; //"Corp 1.3"
phases.corpActionStart.next = phases.corpActionMain; //"Corp 2.1"
phases.corpActionMain.next = phases.corpPostAction; //"Corp 2.2"
phases.corpPostAction.next = phases.corpActionMain; //"Corp 2.2*"
phases.corpDiscardStart.next = phases.corpDiscardResponse; //"Corp 3.1"
phases.corpDiscardResponse.next = phases.corpEndOfTurn; //"Corp 3.2"
phases.corpEndOfTurn.next = phases.runnerStartResponse; //"Corp 3.3"
//Runner turn
phases.runnerStartResponse.next = phases.runnerTurnBegin; //"Runner 1.1"
phases.runnerTurnBegin.next = phases.runnerActionMain; //"Runner 1.2"
phases.runnerActionMain.next = phases.runnerPostAction; //"Runner 1.3"
phases.runnerPostAction.next = phases.runnerActionMain; //"Runner 1.3*"
phases.runnerDiscardStart.next = phases.runnerDiscardResponse; //"Runner 2.1"
phases.runnerDiscardResponse.next = phases.runnerEndOfTurn; //"Runner 2.2"
phases.runnerEndOfTurn.next = phases.corpStartDraw; //"Runner 2.3"
//Run (these phases are coded as part of a run...make a custom copy to use outside of a run)
phases.runApproachIce.next = phases.runRezApproachedIce; //"Run 2.1"
phases.runRezApproachedIce.next = phases.runEncounterIce; //"Run 2.2"
phases.runEncounterIce.next = phases.runSubroutines; //"Run 3.1"
phases.runSubroutines.next = phases.runDecideContinue; //"Run Subroutines"
phases.runDecideContinue.next = phases.runResponseBeforeApproach; //"Run 4.3"
phases.runResponseBeforeApproach.next = phases.runApproachServer; //"Run 4.5"  by default after ice will move to approach server (change to indicate ice is there to approach)
phases.runApproachServer.next = phases.runSuccessful; //"Run 4.6.2"
phases.runSuccessful.next = phases.runBreachServer; //"Run 5.1"
phases.runBreachServer.next = phases.runAccessingCard; //"Run 5.2"
phases.runAccessingCard.next = phases.runEnds; //"Run Accessing"
phases.runUnsuccessful.next = phases.runEnds; //"Run 6.3"
phases.runEnds.next = phases.runnerPostAction; //"Run 6.4"

//for usability when human playing Corp
CombineResponseWithPhase(
  phases.corpPostAction,
  phases.corpActionMain,
  phases.corpDiscardStart,
  phases.corpPostAction,
  function () {
    return corp.clickTracker < 1;
  }
);
CombineResponseWithPhase(
  phases.corpActionStart,
  phases.corpActionMain,
  phases.corpDiscardStart,
  phases.corpPostAction,
  function () {
    return corp.clickTracker < 1;
  }
);

//due to a limitation of css we need to modify the padding and margin of the history bar
//in order for the tooltip text to be visible with the history bar scrollable
function _history_wrapper_expand() {
  $("#history-wrapper").css("padding-left", "100%");
  $("#history-wrapper").css("margin-left", "-100%");
}
function _history_wrapper_shrink() {
  $("#history-wrapper").css("padding-left", "0");
  $("#history-wrapper").css("margin-left", "0");
}
$(function () {
  $("#history").hover(
    function () {
      _history_wrapper_expand();
    },
    function () {
      // on mouseout, reset
      _history_wrapper_shrink();
    }
  );
});

//helper function for ChangePhase
function AddHistoryBreakIfRequired(player) {
  var historyBreak = null;

  if (currentPhase.historyBreak) historyBreak = currentPhase.historyBreak;

  if (historyBreak) {
    //finish the previous one
    var textspanelem = $("#history")
      .children()
      .first()
      .children()
      .first()
      .children("span")
      .first();
    if (textspanelem.html() == "...") textspanelem.html("-");
    //now the new one
    var colouredPhaseTitle = "<span style='color:blue;'>";
    var historyClass = "historyentry-corp";
    if (historyBreak.style == "small") historyClass = "historyentry-corp-small";
    if (player == runner) {
      //colour of history entries is based on whose turn it is
      colouredPhaseTitle = "<span style='color:red;'>";
      historyClass = "historyentry-runner";
      if (historyBreak.style == "small")
        historyClass = "historyentry-runner-small";
      else if (historyBreak.style == "run")
        historyClass = "historyentry-runner-run";
    }
    colouredPhaseTitle += historyBreak.title + "</span>";
    $("#history").children().first().css({ opacity: "1" });
    //on desktop you can just hover, on mobile we need this touch start/end code
    $("#history").prepend(
      '<div ontouchstart="$(this).children(\'.tooltiptext\').show(); _history_wrapper_expand();" ontouchend="$(this).children(\'.tooltiptext\').hide(); _history_wrapper_shrink();" class="tooltip historyentry ' +
        historyClass +
        '"><div class="historycontents"></div><pre class="tooltiptext">' +
        colouredPhaseTitle +
        "</pre></div>"
    );
    SetHistoryThumbnail("", "...");
    $("#history").children().first().css({ opacity: "0.5" });
    //$("#history").css({top:"15px"});
    //$("#history").animate({top: "65px"},1000);
  }
}

/**
 * Change the phase.<br/>Use this or IncrementPhase() which moves to default next phase. Never assign directly to currentPhase.<br/>LogDebug on success, LogError on failure.
 *
 * @method ChangePhase
 * @param {Phase} src phase to change to
 * @param {Boolean} [skipInit=false] identifier of phase to change to
 */
function ChangePhase(src, skipInit = false) {
  var nextPhase = src;
  LogDebug("Entering subphase " + nextPhase.identifier);
  var previousPhase = currentPhase;
  currentPhase = nextPhase;

  if (currentPhase.identifier == "Corp 1.1") playerTurn = corp;
  else if (currentPhase.identifier == "Runner 1.1") playerTurn = runner;

  activePlayer = currentPhase.player;
  $("#header").html("<h2>" + TurnPhaseStr() + "</h2>");
  if (skipInit !== true) {
    /*
		var previous = "";
		if (previousPhase) previous = previousPhase.identifier;
		var current = currentPhase.identifier;
		var next = currentPhase.next.identifier;
		console.log("Previous: "+previous);
		console.log("Current: "+current);
		console.log("Next: "+next);
		console.log(currentPhase.historyBreak);
		*/

    //add a history break if required (some history breaks need to not be deferred)
    if (currentPhase.identifier == "Corp Mulligan")
      AddHistoryBreakIfRequired(corp);
    else if (currentPhase.identifier == "Runner Mulligan")
      AddHistoryBreakIfRequired(runner);
    else currentPhase.deferredHistoryBreak = playerTurn;

    //init the new phase
    if (typeof currentPhase.Init == "function") currentPhase.Init();

    //identifier can be used to trigger tutorial actions
    TutorialReplacer = null;
    if (typeof corp.identityCard.Tutorial !== "undefined")
      corp.identityCard.Tutorial.call(
        corp.identityCard,
        currentPhase.identifier
      );
    else if (typeof runner.identityCard.Tutorial !== "undefined")
      runner.identityCard.Tutorial.call(
        runner.identityCard,
        currentPhase.identifier
      );
  }
}

/**
 * Set the phase history thumbnail.<br/>Nothing is logged.
 *
 * @method SetHistoryThumbnail
 * @param {String} imageFile name of image file, including extension (can be blank)
 * @param {String} [text=""] text label
 * @param {String} [style=""] style extra css for the image
 */
function SetHistoryThumbnail(imageFile, text = "", style = "") {
  var outstr = "";
  if (imageFile != "")
    outstr +=
      '<img src="images/' +
      imageFile +
      '" height="30px" style="grid-column: 1;  grid-row: 1; margin:auto; ' +
      style +
      '"/>';
  if (text != "")
    outstr += '<span style="grid-column: 1;  grid-row: 1;">' + text + "</span>";
  $("#history").children().first().children().first().html(outstr);
}

/**
 * Change to default next phase as defined by currentPhase.next.<br/>Use this or ChangePhase(src) which moves to a phase by identifier. Never assign directly to currentPhase.
 *
 * @method IncrementPhase
 * @param {Boolean} [skipInit=false] identifier of phase to change to
 */
function IncrementPhase(skipInit = false) {
  if (currentPhase == null) ChangePhase(phases.corpMulligan, skipInit);
  else ChangePhase(currentPhase.next, skipInit);
}

/**
 * Special phase to ask for a custom player decision.<br/>Will return to the previous phase when done (without calling init).<br/>It is your responsibility to make sure that things will continue smoothly from there.
 *
 * @method DecisionPhase
 * @param {Player} player who will make the decision, either corp or runner
 * @param {Params[][]} choices for the player to choose between. Each must contain params.label
 * @param {function} callback called with chosen params once choice has been made
 * @param {String} title phase title (supply null to keep existing phase title)
 * @param {String} [instruction] to display in footer
 * @param {Object} [context] context for function to be called in
 * @param {String} [command] default phase command (usually "continue")
 * @param {function} [cancelCallback] if set, enables cancel option (will be called in same context as callback)
 * @returns {Phase} the phase object created and changed to
 */
function DecisionPhase(
  player,
  choices,
  callback,
  title,
  instruction,
  context,
  command = "continue",
  cancelCallback
) {
  var decisionPhase = {
    Enumerate: {},
    Resolve: {},
  };
  decisionPhase.Enumerate[command] = function () {
    return choices;
  };
  decisionPhase.Resolve[command] = function (params) {
    IncrementPhase(true); //return to original phase before callback in case the callback needs to change phase
    if (typeof context !== "undefined") callback.call(context, params);
    else callback(params);
  };
  decisionPhase.player = player;
  if (title === null) decisionPhase.title = currentPhase.title;
  else decisionPhase.title = title;
  decisionPhase.identifier = currentPhase.identifier;
  decisionPhase.next = currentPhase;
  if (typeof instruction !== "undefined") {
    decisionPhase.text = {};
    decisionPhase.text[command] = instruction;
  }
  if (typeof cancelCallback !== "undefined") {
    decisionPhase.Cancel = {};
    decisionPhase.Cancel[command] = function () {
      cancelCallback.call(context);
    };
  }
  ChangePhase(decisionPhase);
  return decisionPhase;
}

/**
 * Quick setup for a binary player decision.<br/>Callback will only be called if actMessage is chosen.
 *
 * @method BinaryDecisionPhase
 * @param {Player} player who will make the decision, either corp or runner
 * @param {String} actMessage label for the button to take the action
 * @param {String} continueMessage label for the button to skip the action
 * @param {String} title phase title shown in header (supply null to keep existing phase title)
 * @param {Object} [context] context for function to be called in
 * @param {function} callback called with chosen params once choice has been made
 * @returns {Object[]} the choices list
 */
function BinaryDecision(
  player,
  actMessage,
  continueMessage,
  title,
  context,
  callBack
) {
  var choices = [
    { id: 0, label: actMessage, button: actMessage },
    { id: 1, label: continueMessage, button: continueMessage },
  ];
  function decisionCallback(params) {
    if (params.id == 0) callBack.call(context);
  }
  DecisionPhase(player, choices, decisionCallback, title, "", context); //there are buttons so no footer text
  return choices;
}

/**
 * Quick setup for triggered conditions that may need decisions (i.e. not all automatic).
 *
 * @method DecisionPhaseTriggered
 * @param {String} triggerName to enumerate trigger list
 * @param {function} afterOpportunity called once all triggers have resolved for both players
 * @param {Object} [context] context for function to be called in
 * @returns {Phase} the phase object created and changed to
 */
function DecisionPhaseTriggered(triggerName, afterOpportunity, context) {
  var triggeredPhase = CreatePhaseFromTemplate(
    phaseTemplates.globalTriggers,
    playerTurn,
    currentPhase.title,
    currentPhase.identifier,
    null
  );
  triggeredPhase.triggerCallbackName = triggerName;
  triggeredPhase.next = currentPhase;
  triggeredPhase.Resolve.n = function () {
    GlobalTriggersPhaseCommonResolveN(true, afterOpportunity, context); //true skips init so we return to current phase
  };
  ChangePhase(triggeredPhase);
  return triggeredPhase;
}
