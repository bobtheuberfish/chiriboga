//MECHANICS
//These are GAME MECHANIC functions, performing acts that are like physical movements, these take inputs that make sense in terms of the game e.g. card object, server object, integer value, player reference.
//These functions make no validity/legality checks or payments, and they Log the result. Usually nothing is returned but that's not a requirement.

/**
 * Make a run.<br/>Assumes all checks have been made (e.g. valid server).<br/>Logs the declaration.
 *
 * @method MakeRun
 * @param {Server} server e.g. corp.HQ or corp.remoteServers[0]
 */
function MakeRun(server) {
  //Declare attacked server (Nisei 2021 1.1)
  attackedServer = server;
  Log("Run initiated attacking " + server.serverName);
  GainCredits(runner, corp.badPublicity, "bad publicity"); //(Nisei 2021 1.2)
  AutomaticTriggers("runBegins", server); //(Nisei 2021 1.3) but only automatics at the moment
  approachIce = attackedServer.ice.length - 1;
  if (attackedServer.ice.length > 0) {
	  //(Nisei 2021 1.4.1 sends to 2.1)
	  ChangePhase(phases.runApproachIce);
  }
  else ChangePhase(phases.runDecideContinue); //(Nisei 2021 1.4.2 sends to 4; 4.1 doesn't apply so go directly to 4.2)
  Render(); //to update server glow
}

/**
 * Bypass the currently encountered ice.<br/>This is logged.
 *
 * @method Bypass
 */
function Bypass() {
	Log(GetTitle(attackedServer.ice[approachIce], true)+" bypassed");
	//clear AI run cache (the bypassed ice needs to be ignored)
	if (runner.AI != null) {
		runner.AI.cachedBestPath = null; //force a recalculation
	}
	phases.runEncounterEnd.next = phases.runPassesIce; //this needs to be said because it's not constant what happens when the encounter ends (e.g. the run may end)
	ChangePhase(phases.runEncounterEnd);
}

/**
 * Advance an installed card.<br/>Makes no checks or payments.<br/>Logs the result.
 *
 * @method Advance
 * @param {Card} card the card to advance
 */
function Advance(card) {
  if (typeof card.advancement === "undefined") card.advancement = 0;
  card.advancement++;
  Log("Card advanced");
  AutomaticTriggers("cardAdvanced", card);
}

/**
 * Place advancement tokens on a card.<br/>No checks are performed.</br>Logs the result.
 *
 * @method PlaceAdvancement
 * @param {Card} card to place advancement tokens on
 * @param {int} num number of advancement tokens to place
 */
function PlaceAdvancement(card, num) {
  if (num < 1) return;
  if (typeof card.advancement === "undefined") card.advancement = num;
  else card.advancement += num;
  if (num == 1) Log("1 advancement token placed on " + GetTitle(card, true));
  else Log(num + " advancement tokens placed on " + GetTitle(card, true));
  UpdateCounters();
}

/**
 * Rez an installed card.<br/>Makes no checks or payments.<br/>Logs the result.
 *
 * @method Rez
 * @param {Card} card the card to rez
 */
function Rez(card) {
  card.rezzed = true;
  card.renderer.FaceUp(); //in case Render is not forthcoming
  if (runner.AI != null) {
    runner.AI.LoseInfoAboutHQCards(card);
    if (GetApproachEncounterIce() == card) {
      //update run calculation now that the ice is known
      //ideally complete run
      if (!runner.AI._calculateBestCompleteRun(attackedServer, 0, 0, 0, 0, null, approachIce)) //null means no bonus breaker
      //but if not, use an exit strategy (incomplete run)
      runner.AI._calculateBestExitStrategy(
        attackedServer,
		0,
        0,
        0,
        0,
		null, //no bonus breaker
        approachIce
      );
    }
  }
  Log("Corp rezzed " + GetTitle(card, true));
  //if unique, old one is immediately and unpreventably trashed (except if facedown, and facedown cards don't count for check)
  if (typeof card.unique !== "undefined") {
    if (card.unique == true) {
      var installedCards = InstalledCards(card.player);
      for (var i = 0; i < installedCards.length; i++) {
        if (installedCards[i] != card && installedCards[i].rezzed) {
          if (GetTitle(installedCards[i]) == GetTitle(card)) {
            Log(
              GetTitle(card) +
                " is unique, the older copy will be unpreventably trashed."
            );
            Trash(installedCards[i], false);
          }
        }
      }
    }
  }
  AutomaticTriggers("cardRezzed", card);
}

/**
 * Remove a card from the game<br/>Makes no checks or payments.<br/>Logs the result.
 *
 * @method RemoveFromGame
 * @param {Card} card the card to remove from game
 */
function RemoveFromGame(card) {
  card.host = null;
  MoveCard(card, removedFromGame);
  Log(GetTitle(card, true) + " removed from the game");
}

/**
 * Trash a card.<br/>Makes no checks or payments.<br/>Logs the result.
 *
 * @method Trash
 * @param {Card} card the card to trash
 * @param {Boolean} canBePrevented true if can be prevented, false if not (e.g. is a cost)
 * @param {function} [afterTrashing] called after trashing is complete
 * @param {Object} [context] for afterTrashing
 */
function Trash(card, canBePrevented, afterTrashing, context) {
  if (canBePrevented) {
    intended.trash = card;
    OpportunityForAvoidPrevent(intended.trash.player, "trash", [], function () {
      if (intended.trash == null) return;
      Trash(intended.trash, false, afterTrashing, context);
    });
  } else {
    card.host = null;
    if (runner.AI != null && card.cardLocation == corp.HQ.cards)
      runner.AI.LoseInfoAboutHQCards(card);
    //if the currently encountered ice is trashed, it's no longer being encountered
    if (GetApproachEncounterIce() == card) {
      encountering = false;
      subroutine = -1;
    }
    //now move it
    MoveCard(card, PlayerTrashPile(card.player));
    if (card.player == runner) card.faceUp = true;
    Log(GetTitle(card, true) + " trashed");

    AutomaticTriggers("cardTrashed", card);

    if (typeof card.hostedCards !== "undefined") {
      while (card.hostedCards.length > 0) Trash(card.hostedCards[0], false);
    }
    if (typeof afterTrashing === "function") {
      afterTrashing.call(context);
    }
  }
}

/**
 * Trash the card being accessed.<br/>Makes no checks or payments.<br/>Logs the result.
 *
 * @method TrashAccessedCard
 * @param {Boolean} canBePrevented true if can be prevented, false if not (e.g. is a cost)
 */
function TrashAccessedCard(canBePrevented) {
  if (PlayerCanLook(corp, accessingCard)) accessingCard.faceUp = true;
  var originalLocation = accessingCard.cardLocation;
  SetHistoryThumbnail(accessingCard.imageFile, "Trash");
  Trash(accessingCard, canBePrevented, function () {
    ResolveAccess(originalLocation);
  });
}

/**
 * Install a card.<br/>Makes no checks and spends no clicks, but provides opportunity to trash cards (if relevant), and spends the relevant credit cost.<br/>Logs the result.
 *
 * @method Install
 * @param {Card} installingCard card to install
 * @param {Server|Card} [destination] for corp this is the server, for runner this is the host card (default = null)
 * @param {Boolean} [ignoreAllCosts] if set to true, no costs will be paid (except those already paid)
 * @param {int} [position] insert ice at the given position (null will install outermost)
 * @param {Boolean} [returnToPhase] if set to true, phase after install will be what currentPhase was before install (rather than currentPhase.next)
 * @param {function} [onInstallResolve] fires if the install is not cancelled
 * @param {Object} [context] for onInstallResolve (and onCancelResolve, if relevant)
 * @param {function} [onCancelResolve] fires if the install is cancelled
 * @param {function} [onPaymentComplete] fires once the credits (if any) are paid
 * @returns {Phase} the phase object created and changed to
 */
function Install(
  installingCard,
  destination = null,
  ignoreAllCosts = false,
  position = null,
  returnToPhase = true,
  onInstallResolve,
  context,
  onCancelResolve,
  onPaymentComplete
) {
  var oldLocation = installingCard.cardLocation; //in case of cancel
  var oldPhase = currentPhase; //in case of cancel
  MoveCard(installingCard, installingCard.player.installingCards); //installing cards are kept here instead of resolvingCards, so they sit where you put them while they resolve

  var host = null;
  if (installingCard.player == corp) {
    if (destination == null) {
      destination = NewServer("Remote " + corp.serverIncrementer++, false);
      corp.remoteServers.push(destination);
    }
  } else {
    installingCard.faceUp = true;
    host = destination;
  }

  var installDestination = InstallDestination(installingCard, destination);
  var installTrashPhase = {
    Enumerate: {
      trash: function () {
        if (installDestination == runner.rig.resources) return [];
        if (installDestination == runner.rig.hardware) return [];
        if (installingCard.cardType == "program") {
			/*
          //for usability we will skip trashing if there is enough MU left
          if (
            installingCard.cardType == "program" &&
            typeof (installingCard.memoryCost !== "undefined")
          ) {
            if (
              installingCard.memoryCost + InstalledMemoryCost(destination) <=
              MemoryUnits(destination)
            )
              return [];
          }
          //but we'll leave this line here just in case, or for later
		  */
          return ChoicesInstalledCards(runner, function (card) {
            return CheckCardType(card, ["program"]);
          }); //The Runner can choose to trash any number of his installed programs at the beginning of an install program action. [Core rulebook]
        }
        return ChoicesArrayCards(installDestination, CheckTrash);
      },
      n: function () {
        if (installingCard.player == corp) {
          if (
            !CheckCredits(
              InstallCost(
                installingCard,
                destination,
                ignoreAllCosts,
                position
              ),
              corp,
              "installing",
              installingCard
            )
          )
            return []; //can't afford to n yet
          if (
            installingCard.cardType == "agenda" ||
            installingCard.cardType == "asset"
          ) {
            var cardlist = InstallDestination(installingCard, destination);
            for (var i = 0; i < cardlist.length; i++) {
              if (
                cardlist[i].cardType == "agenda" ||
                cardlist[i].cardType == "asset"
              )
                return []; //only one asset/agenda allowed
            }
          } else if (CheckSubType(installingCard, "Region")) {
            //upgrade subtype
            var cardlist = InstallDestination(installingCard, destination);
            for (var i = 0; i < cardlist.length; i++) {
              if (CheckSubType(cardlist[i], "Region")) return []; //limit 1 one region per server (even facedown!)
            }
          }
          return [{}];
        } else if (installingCard.player == runner) {
          //only check to do here is make sure enough available MU (sufficient programs trashed)
          if (
            installingCard.cardType == "program" &&
            typeof (installingCard.memoryCost !== "undefined")
          ) {
            if (
              installingCard.memoryCost + InstalledMemoryCost(destination) >
              MemoryUnits(destination)
            )
              return [];
          }
          return [{}];
        }
        return [];
      },
    },
    Cancel: {
      trash: function () {
        ChangePhase(oldPhase, true);
        MoveCard(installingCard, oldLocation);
        if (typeof onCancelResolve === "function")
          onCancelResolve.call(context);
        Cancel();
        Render();
      },
    },
    Resolve: {
	  //see Nisei CR 1.5 8.5.13 for steps of installing (e.g. trash, pay, trigger "when installed")
      trash: function (params) {
        var storedServer = GetServerByArray(installDestination); //as above, see below
        var serverIndex = corp.remoteServers.indexOf(storedServer); //to make sure servers aren't destroyed here (see below)
        Trash(params.card, false);
        //if this move destroyed a remote server, it shouldn't have (see CR1.5 8.5.9)
        if (installingCard.player == corp && serverIndex > -1) {
          if (GetServerByArray(installDestination) == null)
            corp.remoteServers.splice(serverIndex, 0, storedServer);
        }
        currentPhase.Cancel = undefined; //once trashing begins there is no going back
        delete currentPhase.Cancel; //remove the variable completely
        Render();
      },
      n: function () {
        //card will be installed, callback fires
        if (typeof onInstallResolve === "function")
          onInstallResolve.call(context);
        //if clicks were spent, it was done before trash (or as part of callback) so no need to SpendClicks here
        SpendCredits(
          installingCard.player,
          InstallCost(installingCard, destination, ignoreAllCosts, position),
          "installing",
          installingCard,
          function () {
			//payment done, callback fires
			if (typeof onPaymentComplete === "function")
			  onPaymentComplete.call(context);
		    //move the card, write to the logs, etc
            if (installingCard.player == corp) {
              //corp cards are installed facedown
              if (installingCard.rezzed) {
                installingCard.knownToRunner = true;
                installingCard.rezzed = false;
              }
              if (installingCard.faceUp) {
                installingCard.knownToRunner = true;
                installingCard.faceUp = false;
              }
            }
            MoveCard(installingCard, installDestination, position); //if position not specified, this uses .push (i.e. ice will be installed outermost)
            if (runner.AI != null && oldLocation == corp.HQ.cards)
              runner.AI.LoseInfoAboutHQCards(null, installingCard.cardType); //one less card in corp hand
            if (host != null) installingCard.host = host;
            if (typeof installingCard.recurringCredits !== "undefined")
              installingCard.credits = installingCard.recurringCredits;
            var outStr = GetTitle(installingCard, true);
            if (CheckCardType(installingCard, ["agenda", "asset", "upgrade"]))
              outStr =
                "a card in root of " + CardServerName(installingCard, true);
            else if (CheckCardType(installingCard, ["ice"]))
              outStr = "ice protecting " + CardServerName(installingCard, true);
            Log(PlayerName(installingCard.player) + " installed " + outStr);
            //if unique, old one is immediately and unpreventably trashed (except if facedown, and facedown cards don't count for check)
            if (
              typeof installingCard.unique !== "undefined" &&
              installingCard.faceUp
            ) {
              if (installingCard.unique == true) {
                var installedCards = InstalledCards(installingCard.player);
                for (var i = 0; i < installedCards.length; i++) {
                  if (
                    installedCards[i] != installingCard &&
                    installedCards[i].faceUp
                  ) {
                    if (
                      GetTitle(installedCards[i]) == GetTitle(installingCard)
                    ) {
                      Log(
                        GetTitle(installingCard) +
                          " is unique, the older copy will be unpreventably trashed."
                      );
                      Trash(installedCards[i], false);
                    }
                  }
                }
              }
            }
            //install done, card becomes active
			//first the automatic triggers
			AutomaticTriggers("cardInstalled", installingCard);
			//then the Enumerate ones
			//currently giving whoever's turn it is priority...not sure this is always going to be right
			TriggeredResponsePhase(playerTurn, "installed", [installingCard], function() {
				IncrementPhase(returnToPhase);
			});
          },
          this
        );
      },
    },
  };
  if (returnToPhase) installTrashPhase.next = currentPhase;
  else installTrashPhase.next = currentPhase.next;
  installTrashPhase.player = installingCard.player;
  installTrashPhase.title = "Trash Before Install";
  if (installingCard.player == corp)
    installTrashPhase.identifier = "Corp Install";
  else if (installingCard.player == runner)
    installTrashPhase.identifier = "Runner Install";

  ChangePhase(installTrashPhase);
  executingCommand = "trash";
  return installTrashPhase;
}

/**
 * Play a card from hand as an action.<br/>Makes no checks or payments and does not move card to heap/archives (card code should do this after resolving).<br/>Logs the result.
 *
 * @method Play
 * @param {Card} card the card to play
 * @param {function} [onPlayResolve] fires if the play is not cancelled (i.e. right BEFORE the card begins to resolve)
 * @param {Object} [context] for onPlayResolve
 * @returns {Phase} the phase object created and changed to
 */
function Play(card, onPlayResolve, context) {
  var oldLocation = card.cardLocation; //in case of cancel
  var oldPhase = currentPhase; //in case of cancel
  MoveCard(card, card.player.resolvingCards);
  card.faceUp = true; //this is no secret...
  var choices = [{}]; //assume valid by default
  if (typeof card.Enumerate === "function") {
    choices = card.Enumerate.call(card);
  }
  var instruction = GetTitle(card, true);
  if (typeof card.text !== "undefined") instruction = card.text;
  //note these will be called in the context of the card
  var cancelCallback = function () {
    ChangePhase(oldPhase, true);
    MoveCard(card, oldLocation);
    Cancel();
    Render();
  };
  var resolveCallback = function (params) {
    //card will be installed, callback fires
    if (typeof onPlayResolve === "function") onPlayResolve.call(context);
    if (runner.AI != null) runner.AI.LoseInfoAboutHQCards(card);
    Log('Played "' + GetTitle(card, true) + '"');
	AutomaticTriggers("cardPlayed", card);
    card.Resolve.call(card, params);
  };
  var command = "continue";
  if (typeof card.command !== "undefined") command = card.command;
  return DecisionPhase(
    card.player,
    choices,
    resolveCallback,
    "Playing " + GetTitle(card, true),
    instruction,
    card,
    command,
    cancelCallback
  );
}

/**
 * Break a subroutine.<br/>Makes no checks or payments.<br/>Logs the result.
 *
 * @method Break
 * @param {Subroutine} subroutine the subroutine to break
 */
function Break(subroutine) {
  subroutine.broken = true;
  //particle effect
  var card = GetApproachEncounterIce();
  if (card && typeof subroutine.visual !== "undefined") {
    particleSystems.breaksubroutine.spawnRect.x =
      209 - subroutine.visual.y + 0.5 * subroutine.visual.h; //-209 is half card height
    cardRenderer.ParticleEffect(
      card.renderer.particleContainer,
      particleSystems.breaksubroutine
    );
  }
  Log('Subroutine "' + subroutine.text + '" broken');
}

/**
 * Trigger a card's ability or subroutine.<br/>Makes no checks or payments.<br/>Logs the result.
 *
 * @method Trigger
 * @param {Card} card card which the ability is on
 * @param {Triggerable} triggerable object which has .text and .Resolve(params) or .Resolve()
 * @param {Params} params parameters to use (omit if triggerable.Resolve doesn't require it)
 */
function Trigger(card, triggerable, params, customVerb='Using') {
  if (typeof triggerable.text !== "undefined")
    Log(customVerb+' "' + triggerable.text + '" on ' + GetTitle(card) + ":");
  else Log(customVerb+" " + GetTitle(card) + ":");
  triggerable.Resolve.call(card, params); //call in context of the card
}

/**
 * Trigger a card's ability, making decisions where necessary.<br/>Logs the result.
 *
 * @method TriggerAbility
 * @param {Card} card card which the ability is on
 * @param {Ability} ability object which has .text and either .Enumerate() with .Resolve(params) or just .Resolve()
 * @param {function} [onTriggerResolve] fires if the play is not cancelled
 * @param {Object} [context] for onTriggerResolve
 * @returns {Phase} the phase object created and changed to
 */
function TriggerAbility(card, ability, onTriggerResolve, context) {
  var oldPhase = currentPhase; //in case of cancel
  var choices = [{}]; //assume valid by default
  if (typeof ability.Enumerate === "function") {
    choices = ability.Enumerate.call(card); //call in context of the card
  }
  var instruction = GetTitle(card, true);
  if (typeof ability.text !== "undefined") instruction = ability.text;
  //note these will be called in the context of the card
  var cancelCallback = function () {
    ChangePhase(oldPhase, true);
    Cancel();
    //Render();
  };
  var resolveCallback = function (params) {
    //ability will be triggered, callback fires
    if (typeof onTriggerResolve === "function") onTriggerResolve.call(context);
    //Log("Triggered \""+ability.text+"\"");
    Log("Using " + GetTitle(card, true) + ":");
    ability.Resolve.call(card, params); //call in context of the card
  };
  var player = card.player;
  if (ability.opponentOnly) {
    if (player == runner) player = corp;
    else if (player == corp) player = runner;
  }
  return DecisionPhase(
    player,
    choices,
    resolveCallback,
    instruction,
    instruction,
    card,
    "continue",
    cancelCallback
  );
}

/**
 * Discard a card.<br/>Makes no checks or payments.<br/>Logs the result.
 *
 * @method Discard
 * @param {Card} card card in hand to discard
 * @returns {Card} the card discarded
 */
function Discard(card) {
  if (card.player == runner) card.faceUp = true;
  Log(PlayerName(card.player)+' discarded "' + GetTitle(card, true) + '"');
  MoveCard(card, PlayerTrashPile(card.player));
  return card;
}

/**
 * Runner takes net damage (runner randomly trashes cards from grip).<br/>Stops on flatline.<br/>Logs the result.
 *
 * @method NetDamage
 * @param {int} num number of net damage to take
 * @param {function(cardsTrashed)} [afterTrashing] called after trashing is complete (even if no cards are trashed), cards will be an array
 * @param {Object} [context] for afterTrashing
 */
function NetDamage(num, afterTrashing, context) {
  intended.netDamage = num;
  var cardsTrashed = [];
  var trashCallback = function () {
    if (intended.netDamage < 1) {
      if (typeof afterTrashing === "function")
        afterTrashing.call(context, cardsTrashed);
      return;
    }
    if (runner.grip.length == 0) {
      PlayerWin(corp, "Runner flatlined");
      return;
    }
    intended.netDamage--;
    var cardToTrash = runner.grip[RandomRange(0, runner.grip.length - 1)];
    cardsTrashed.push(cardToTrash);
    Trash(cardToTrash, true, trashCallback);
  };
  OpportunityForAvoidPrevent(runner, "netDamage", [], function () {
    Log("Runner takes " + intended.netDamage + " net damage");
    trashCallback();
  });
}

/**
 * Runner takes meat damage (runner randomly trashes cards from grip).<br/>Stops on flatline.<br/>Logs the result.
 *
 * @method MeatDamage
 * @param {int} num number of meat damage to take
 * @param {function} [afterTrashing] called after trashing is complete (even if no cards are trashed)
 * @param {Object} [context] for afterTrashing
 */
function MeatDamage(num, afterTrashing, context) {
  intended.meatDamage = num;
  var trashCallback = function () {
    if (intended.meatDamage < 1) {
      if (typeof afterTrashing === "function") afterTrashing.call(context);
      return;
    }
    if (runner.grip.length == 0) {
      PlayerWin(corp, "Runner flatlined");
      return;
    }
    intended.meatDamage--;
    Trash(
      runner.grip[RandomRange(0, runner.grip.length - 1)],
      true,
      trashCallback
    );
  };
  OpportunityForAvoidPrevent(runner, "meatDamage", [], function () {
    Log("Runner takes " + intended.meatDamage + " meat damage");
    trashCallback();
  });
}

/**
 * Runner takes brain damage (runner randomly trashes cards from grip, and gains a brain damage token which decreases grip max size).<br/>Stops on flatline.<br/>Logs the result.
 *
 * @method BrainDamage
 * @param {int} num number of brain damage to take
 * @returns {int} actual brain damage taken
 */
function BrainDamage(num) {
  Log("Runner takes " + num + " brain damage");
  var numTaken = 0;
  for (var i = 0; i < num; i++) {
    if (runner.grip.length == 0) {
      PlayerWin(corp, "Runner flatlined");
      return numTaken;
    } else {
      Trash(runner.grip[RandomRange(0, runner.grip.length - 1)], true);
      numTaken++;
    }
  }
  runner.brainDamage++;
  return numTaken;
}

/**
 * Purges all virus counters from all cards.</br>Makes no checks or payments.<br/>Logs the result.
 *
 * @method Purge
 */
function Purge() {
  var numPurged = 0;
  ApplyToAllCards(function (card) {
    if (typeof (card.virus !== "undefined")) {
		numPurged += card.virus;
		card.virus = 0;
	}
  });
  Log("Virus counters purged");
  AutomaticTriggers("purged", numPurged);
}

/**
 * A player draws cards.<br/>Stops on corp draw from empty R&D.<br/>Logs the result.
 *
 * @method Draw
 * @param {Player} player either corp or runner
 * @param {int} num number of cards to attempt to draw
 * @returns {int} the number of cards drawn
 */
function Draw(player, num) {
  if (num < 1) return 0;
  //draw for corp (lose if impossible)
  if (player == corp) {
    var maxDraw = corp.RnD.cards.length;
    if (maxDraw < num) {
      PlayerWin(runner, "Corp attempted to draw a card from empty R&D");
      return 0;
    } else {
      for (var i = 0; i < num; i++) {
        MoveCardByIndex(
          corp.RnD.cards.length - 1,
          corp.RnD.cards,
          corp.HQ.cards
        );
      }
    }
  }
  //draw for runner (break if impossible)
  else if (player == runner) {
    var maxDraw = runner.stack.length;
    if (maxDraw < num) num = maxDraw;
    for (var i = 0; i < num; i++) {
      MoveCardByIndex(runner.stack.length - 1, runner.stack, runner.grip);
    }
  }
  //write to log
  if (num == 1) Log(PlayerName(player) + " drew a card");
  else if (num > 1) Log(PlayerName(player) + " drew " + num + " cards");
  if (maxDraw == num) {
    if (player == corp) Log("R&D is empty");
    else if (player == runner) Log("Stack is empty");
    else LogError("No player specified for Draw");
  }
  return num;
}

/**
 * A player spends clicks.<br/>No checks are performed.</br>Logs the result.
 *
 * @method SpendClicks
 * @param {Player} player either corp or runner
 * @param {int} num number of clicks to spend
 */
function SpendClicks(player, num) {
  if (num < 1) return;
  player.clickTracker -= num;
  if (num == 1) Log(PlayerName(player) + " spent one click");
  else Log(PlayerName(player) + " spent " + num + " clicks");
}

/**
 * A player gain clicks.<br/>No checks are performed.</br>Logs the result.
 *
 * @method GainClicks
 * @param {Player} player either corp or runner
 * @param {int} num number of clicks to gain
 */
function GainClicks(player, num) {
  if (num < 1) return;
  player.clickTracker += num;
  if (num == 1) Log(PlayerName(player) + " gained one click");
  else Log(PlayerName(player) + " gained " + num + " clicks");
}

/**
 * A player spends credits.<br/>No checks are performed.</br>Logs the result.
 *
 * @method SpendCredits
 * @param {Player} player either corp or runner
 * @param {int} num number of credits to spend
 * @param {String} [doing] for 'recurring credit' checks
 * @param {Card} [card] for 'recurring credit' checks
 * @param {function} [afterSpend] called after spending complete
 * @param {Object} [context] for afterSpend
 */
function SpendCredits(
  player,
  num,
  doing = "",
  card = null,
  afterSpend,
  context
) {
  //new version of this function just automatically uses extra credits sources when available
  //first, temporary credits (e.g. from bad publicity)
  if (player == runner) {
    var spendCred_temporary = Math.min(num, runner.temporaryCredits);
    if (spendCred_temporary > 0) {
      runner.temporaryCredits -= spendCred_temporary;
      num -= spendCred_temporary;
      if (spendCred_temporary == 1)
        Log(PlayerName(player) + " spent one temporary credit");
      //TODO specific messages per type?
      else
        Log(
          PlayerName(player) +
            " spent " +
            spendCred_temporary +
            " temporary credits"
        );
    }
  }
  //second, card-hosted credits
  if (num > 0) {
    var oldNum = num;
    var activeCards = ActiveCards(player);
    for (var i = 0; i < activeCards.length; i++) {
      if (typeof activeCards[i].credits !== "undefined") {
        if (typeof activeCards[i].canUseCredits === "function") {
          if (activeCards[i].canUseCredits(doing, card)) {
            var spendCred_card = Math.min(num, activeCards[i].credits);
            activeCards[i].credits -= spendCred_card;
            num -= spendCred_card;
            if (spendCred_card == 1)
              Log(
                PlayerName(player) +
                  " spent one credit from " +
                  GetTitle(activeCards[i], true)
              );
            else if (spendCred_card > 0)
              Log(
                PlayerName(player) +
                  " spent " +
                  spendCred_card +
                  " credits from " +
                  GetTitle(activeCards[i], true)
              );
          }
        }
      }
    }
    if (num != oldNum) UpdateCounters();
  }
  //lastly, credit pool
  if (num > 0) {
    player.creditPool -= num; //spend the rest from default pool
    if (num == 1) Log(PlayerName(player) + " spent one credit");
    else Log(PlayerName(player) + " spent " + num + " credits");
  }
  //done, do whatever needs to be done after
  if (typeof afterSpend === "function") afterSpend.call(context);

  //old version of this function below allows player to choose which sources to use and when:

  //allow player to use as many credits as desired from recurring sources (continue spends the rest using credit pool)
  /*
	var spendCreditsPhase = {
	Enumerate: {
		use: function() {
			var ret = [];
			//for each available recurring credit source, list from 1 to max(available,required)
			var activeCards = ActiveCards(player);
			for (var i=0; i<activeCards.length; i++)
			{
				if (typeof(activeCards[i].credits) !== 'undefined')
		 		{
					if (typeof(activeCards[i].canUseCredits) === 'function')
					{
						if (activeCards[i].canUseCredits(doing,card))
						{
							for (var j=1; (j<=activeCards[i].credits)&&(j<=num); j++)
							{
								ret.push({card:activeCards[i],num:j,label:"Use "+j+" credits from "+GetTitle(activeCards[i],true)});
							}
						}
					}
				}
			}
			return ret;
		},
		n: function() {
			if (num>Credits(player)) return []; //need to spend more recurring credits
			return [{}];
		}
	 },
	 Resolve: {
		 use: function(params) {
			 params.card.credits-=params.num;
			 num-=params.num;
			 if (params.num == 1) Log(PlayerName(player)+" used one credit from "+GetTitle(params.card,true));
		 	 else Log(PlayerName(player)+" used "+params.num+" credits from "+GetTitle(params.card,true));
		 },
		 n: function() {
			 IncrementPhase(true); //return to original phase before callback in case the callback needs to change phase
			 if (num>0)
			 {
				 var numberSpent = num;
				 //automatically spend temporary credits first if possible
				 if ((player==runner)&&(runner.temporaryCredits > 0))
				 {
					if (runner.temporaryCredits >= num)
					{
						runner.temporaryCredits-=num;
						num=0;
					}
					else //can only partially cover the cost with temporary credits
					{
						num-=runner.temporaryCredits;
						runner.temporaryCredits=0;
					}
			 	 }
		 		 player.creditPool-=num; //spend the rest from default pool
 		 	 	 if (numberSpent == 1) Log(PlayerName(player)+" spent one credit");
		 	 	 else Log(PlayerName(player)+" spent "+numberSpent+" credits");
			 }
			 if (typeof(afterSpend) === 'function') afterSpend.call(context);
		},
		text: {
			use: "Use recurring credits"
		}
	 }
	};
	spendCreditsPhase.player = player;
 	spendCreditsPhase.title = "Spend recurring credits";
 	spendCreditsPhase.identifier = currentPhase.identifier;
	spendCreditsPhase.next = currentPhase;
	ChangePhase(spendCreditsPhase);
	*/
}

/**
 * A player gains credits.<br/>No checks are performed.</br>Logs the result.
 *
 * @method GainCredits
 * @param {Player} player either corp or runner
 * @param {int} num number of credits to gain
 * @param {String} [temporary] set to a reason if any unused will be lost after run (e.g. "bad publicity")
 */
function GainCredits(player, num, temporary = "") {
  if (num < 1) return;
  var bpcStr = "";
  if (temporary != "") {
    runner.temporaryCredits += num;
    bpcStr = " from " + temporary;
  } else player.creditPool += num;
  if (num == 1) Log(PlayerName(player) + " gained one credit" + bpcStr);
  else Log(PlayerName(player) + " gained " + num + " credits" + bpcStr);
  UpdateCounters();
}

/**
 * Place credits on a card (from the bank). Functionally identical to LoadCredits.<br/>No checks are performed.</br>Logs the result.
 *
 * @method PlaceCredits
 * @param {Card} card to place credits on
 * @param {int} num number of credits to place
 */
function PlaceCredits(card, num) {
  if (num < 1) return;
  if (typeof card.credits === "undefined") card.credits = num;
  else card.credits += num;
  if (num == 1) Log("1 credit placed on " + GetTitle(card, true));
  else Log(num + " credits placed on " + GetTitle(card, true));
  UpdateCounters();
}

/**
 * Load credits onto a card (from the bank). Functionally identical to PlaceCredits.<br/>No checks are performed.</br>Logs the result.
 *
 * @method LoadCredits
 * @param {Card} card to load credits onto
 * @param {int} num number of credits to load
 */
function LoadCredits(card, num) {
  if (num < 1) return;
  if (typeof card.credits === "undefined") card.credits = num;
  else card.credits += num;
  if (num == 1) Log("1 credit loaded onto " + GetTitle(card, true));
  else Log(num + " credits loaded onto " + GetTitle(card, true));
  UpdateCounters();
}

/**
 * Take credits from a card (into Runner credit pool).<br/>No checks are performed.</br>Logs the result.
 *
 * @method TakeCredits
 * @param {Card} card to take credits from
 * @param {int} num max number of credits to take
 */
function TakeCredits(player, card, num) {
  if (typeof card.credits === "undefined") return;
  else if (card.credits < num) num = card.credits;
  if (num < 1) return;
  card.credits -= num;
  player.creditPool += num;
  if (num == 1) Log("1 credit taken from " + GetTitle(card, true));
  else Log(num + " credits taken from " + GetTitle(card, true));
  UpdateCounters();
}

/**
 * Removes tags from the runner.<br/>Number of tags will not be decreased to below zero.<br/>Logs the result.
 *
 * @method RemoveTags
 * @param {int} num number of tags to remove
 */
function RemoveTags(num) {
  if (runner.tags >= num) {
    runner.tags -= num;
    if (num == 1) Log("1 tag removed");
    else Log(num + " tags removed");
  } else runner.tags = 0;
  UpdateCounters();
}

/**
 * Adds tags to the runner.<br/>Logs the result.
 *
 * @method AddTags
 * @param {int} num number of tags to add
 */
function AddTags(num) {
  if (num < 1) {
    Log("No tags added");
    return;
  }
  intended.addTags = num;
  OpportunityForAvoidPrevent(runner, "addTags", [], function () {
    runner.tags += intended.addTags;
    if (intended.addTags == 1) Log("1 tag added");
    else Log(intended.addTags + " tags added");
    UpdateCounters();
	//currently giving whoever's turn it is priority...not sure this is always going to be right
    TriggeredResponsePhase(playerTurn, "tagsTaken");
  });
}

/**
 * Adds bad publicity to the corp.<br/>Logs the result.
 *
 * @method BadPublicity
 * @param {int} num number of bad publicity to add
 */
function BadPublicity(num) {
  if (num < 1) {
    Log("No bad publicity added");
    return;
  }
  intended.badPublicity = num;
  OpportunityForAvoidPrevent(corp, "badPublicity", [], function () {
    corp.badPublicity += intended.badPublicity;
    if (intended.badPublicity == 1) Log("1 bad publicity added");
    else Log(intended.badPublicity + " bad publicity added");
    UpdateCounters();
  });
}

/**
 * Moves the specified cards into the given destination and shuffles the destination.<br/>Logs the result.
 *
 * @method ShuffleInto
 * @param {Card[]} cards array containing cards to move
 * @param {Card[]} destination where to put the cards
 */
function ShuffleInto(cards, destination) {
  //first make a shallow copy of the cards array (in case that's their location not just a reference list)
  //that way we can be sure no other effect will remove them from this list, so we can just iterate through it
  cards = cards.slice();
  for (var i = 0; i < cards.length; i++) {
    MoveCard(cards[i], destination);
  }
  Shuffle(destination);
  var outText = "Shuffled " + cards.length + " cards ";
  if (ArrayName(destination) !== "")
    outText += "into " + destination.displayName;
  Log(outText);
}

/**
 * Derez a card.<br/>No checks are performed or payments made.<br/>Logs the result.
 *
 * @method Derez
 * @param {Card} card card to derez
 */
function Derez(card) {
  if (card.rezzed) card.knownToRunner = true;
  card.rezzed = false;
  Log(GetTitle(card, true) + " derezzed");
}

/**
 * Player loses clicks, if possible.<br/>Logs the result.
 *
 * @method LoseClicks
 * @param {Player} player either corp or runner
 * @param {int} num number of clicks to lose
 * @returns {int} number of clicks lost
 */
function LoseClicks(player, num) {
  if (player.clickTracker < num) num = player.clickTracker;
  player.clickTracker -= num;
  if (num == 1) Log(PlayerName(player) + " lost 1 click");
  else if (num > 1) Log(PlayerName(player) + " lost " + num + " clicks");
  else Log(PlayerName(player) + " lost no clicks");
  return num;
}

/**
 * Player loses credits, if possible.<br/>Logs the result.
 *
 * @method LoseCredits
 * @param {Player} player either corp or runner
 * @param {int} num number of credits to lose
 * @returns {int} number of credits lost
 */
function LoseCredits(player, num) {
  var numberLost = 0;
  //automatically lose temporary credits first if possible
  if (runner.temporaryCredits > 0) {
    if (runner.temporaryCredits >= num) {
      numberLost += num;
      runner.temporaryCredits -= num;
      num = 0;
    } //can only partially cover the cost with bad pub credits
    else {
      numberLost += runner.temporaryCredits;
      num -= runner.temporaryCredits;
      runner.temporaryCredits = 0;
    }
  }
  //lose the rest from default pool
  if (player.creditPool < num) num = player.creditPool;
  numberLost += num;
  player.creditPool -= num;
  if (numberLost == 1) Log(PlayerName(player) + " lost 1 credit");
  else if (numberLost > 1)
    Log(PlayerName(player) + " lost " + numberLost + " credits");
  else Log(PlayerName(player) + " lost no credits");
  return numberLost;
}

/**
 * Declares the run unsuccessful and concludes subroutine phase if necessary.<br/>No checks are performed or payments made.
 *
 * @method RunUnsuccessful
 */
function RunUnsuccessful() {
  var originalPhase = currentPhase;
  //if the original phase was subroutines, call .n to ensure encounter ends
  if (originalPhase.identifier == "Run Subroutines") {
    ChangePhase(phases.runUnsuccessful, true); //true skips init because when encounter ends it will change to runUnsuccessful properly
    originalPhase.Resolve.n();
  } //just an ordinary phase change
  else {
    ChangePhase(phases.runUnsuccessful);
  }
}

/**
 * Ends the run, counts as unsuccessful run.<br/>No checks are performed or payments made.<br/>Logs the result.
 *
 * @method EndTheRun
 */
function EndTheRun() {
  Log("Run ended");
  RunUnsuccessful();
}

/**
 * Jack out.<br/>No checks are performed or payments made.
 *
 * @method JackOut
 */
function JackOut() {
  Log("Runner jacked out");
  RunUnsuccessful();
}

/**
 * Score an agenda.<br/>No checks are performed or payments made.<br/>Logs the result.
 *
 * @method Score
 * @param {Card} card the agenda to score
 * @param {function} [afterScore] called after scoring complete
 * @param {Object} [context] for afterScore
 */
function Score(card, afterScore, context) {
  intended.score = card; //if callback sets this to null, the score will not happen
  OpportunityForAvoidPrevent(runner, "score", [], function () {
    if (intended.score == null) return;
    MoveCard(intended.score, corp.scoreArea);
    intended.score.faceUp = true;
    if (runner.AI != null) runner.AI.LoseInfoAboutHQCards(intended.score);
    Log(GetTitle(intended.score, true) + " scored");
	//currently giving whoever's turn it is priority...not sure this is always going to be right
    TriggeredResponsePhase(playerTurn, "scored", [], function () {
      intended.score.advancement = 0;
      intended.score = null;
      if (typeof afterScore === "function") afterScore.call(context);
    });
  });
}

/**
 * Steals the card being accessed.<br/>No checks are performed or payments made.<br/>Logs the result.
 *
 * @method Steal
 */
function Steal() {
  var originalLocation = accessingCard.cardLocation;
  intended.steal = accessingCard; //if callback sets this to null, the steal will not happen
  OpportunityForAvoidPrevent(corp, "steal", [], function () {
    ResolveAccess(originalLocation);
    if (intended.steal == null) return;
	var stolenFromString = "remote";
	if (originalLocation == corp.HQ.cards) stolenFromString = "HQ";
	else if (originalLocation == corp.RnD.cards) stolenFromString = "R&D";
	else if (originalLocation == corp.archives.cards) stolenFromString = "Archives";
	agendaStolenLocations.push(stolenFromString); //for testing/balancing AIs
	
    MoveCard(intended.steal, runner.scoreArea);
    intended.steal.faceUp = true;
    if (runner.AI != null) runner.AI.LoseInfoAboutHQCards(intended.steal);
    Log(GetTitle(intended.steal, true) + " stolen");
	//currently giving whoever's turn it is priority...not sure this is always going to be right
    TriggeredResponsePhase(playerTurn, "stolen", [], function () {
      intended.steal.advancement = 0;
      intended.steal = null;
    });
  });
}

/**
 * Trash num programs.<br/>Provides player choice for each trash, if relevant.<br/>Logs each trash.
 *
 * @method TrashPrograms
 * @param {int} num number of programs to trash (will be limited by number installed)
 */
function TrashPrograms(num) {
  if (num < 1) return; //trashing is over
  var programOptions = ChoicesInstalledCards(runner, function (card) {
    return CheckCardType(card, ["program"]);
  });
  if (programOptions.length < 1) return; //trashing is over
  function decisionCallback(params) {
    Trash(params.card, true);
    TrashPrograms(num - 1); //recurse
  }
  DecisionPhase(
    corp,
    programOptions,
    decisionCallback,
    null,
    "Trash 1 program",
    this
  );
}

/**
 * Expose a card.<br/>No checks are performed or payments made.<br/>Logs the result.
 *
 * @method Expose
 * @param {Card} card the card to expose
 */
function Expose(card) {
  var otherPlayer = runner;
  intended.expose = card; //if callback sets this to null, the expose will not happen
  if (intended.expose.player == runner) otherPlayer = corp;
  OpportunityForAvoidPrevent(otherPlayer, "expose", [], function () {
    if (intended.expose == null) return;
    //temporarily turn card face up
    intended.expose.faceUp = true;
    if (!intended.expose.renderer.zoomed) intended.expose.renderer.ToggleZoom();
    Log(GetTitle(intended.expose) + " exposed");
    function decisionCallback(params) {
      if (intended.expose.renderer.zoomed)
        intended.expose.renderer.ToggleZoom();
      intended.expose.faceUp = false;
    }
    DecisionPhase(
      otherPlayer,
      [{}],
      decisionCallback,
      "Exposing " + GetTitle(intended.expose)
    ).requireHumanInput = true; //finish viewing exposed card
  });
}

/**
 * Reveal a card.<br/>No checks are performed or payments made.<br/>Logs the result.
 *
 * @method Reveal
 * @param {Card} card the card to reveal
 * @param {function} callback called after reveal
 * @param {Object} [context] context for function to be called in
 */
function Reveal(card, callback, context) {
  var otherPlayer = corp;
  if (card.player == corp) otherPlayer = runner;
  //temporarily turn card face up
  card.faceUp = true;
  if (!card.renderer.zoomed) card.renderer.ToggleZoom();
  Log(GetTitle(card) + " revealed");
  function decisionCallback(params) {
    if (card.renderer.zoomed) card.renderer.ToggleZoom();
    card.faceUp = false; //if you want it to remain face up after reveal, set card.faceUp = true; in callback
    callback.call(context);
  }
  DecisionPhase(
    otherPlayer,
    [{}],
    decisionCallback,
    "Revealing " + GetTitle(card)
  ).requireHumanInput = true; //finish viewing revealed card
}

/**
 * Add counters to a card.<br/>Makes no checks or payments.<br/>Logs the result.
 *
 * @method AddCounters
 * @param {Card} card the card to add counter to
 * @param {String} counter type of counter to add
 * @param {int} [num] number of counters to add (1 if omitted)
 */
function AddCounters(card, counter, num = 1) {
  if (typeof card[counter] === "undefined") card[counter] = 0;
  card[counter] += num;
  if (num == 1)
    Log("1 " + counter + " counter placed on " + GetTitle(card, true));
  else Log(num + " " + counter + " counters placed on " + GetTitle(card, true));
  UpdateCounters();
}

/**
 * Remove counters from a card.<br/>Makes no checks or payments.<br/>Logs the result.
 *
 * @method RemoveCounters
 * @param {Card} card the card to remove counter from
 * @param {String} counter type of counter to remove
 * @param {int} [num] number of counters to remove (1 if omitted)
 */
function RemoveCounters(card, counter, num = 1) {
  if (typeof card[counter] === "undefined") card[counter] = 0;
  card[counter] -= num;
  if (num == 1)
    Log("1 " + counter + " counter removed from " + GetTitle(card, true));
  else
    Log(num + " " + counter + " counters removed from " + GetTitle(card, true));
  UpdateCounters();
}

/**
 * Initiate a trace.<br/>No checks are performed or payments made.<br/>Logs the result.
 *
 * @method Trace
 * @param {int} baseStrength base trace strength
 * @param {function} callback called with parameter true if successful, false if unsuccessful
 * @param {Object} [context] context for function to be called in
 */
function Trace(baseStrength, callback, context) {
  var traceStrength = baseStrength;
  Log("Trace initiated");
  var corpChoices = [
    { num: 0, label: "Continue without increasing trace strength" },
  ];
  var i = 1;
  while (CheckCredits(i, corp, "trace")) {
    corpChoices.push({
      num: i,
      label: i + "[c]: Increase trace strength by " + i,
    });
    i++;
  }
  function decisionCallbackA(paramsA) {
    SpendCredits(
      corp,
      paramsA.num,
      "trace",
      null,
      function () {
        traceStrength += paramsA.num;
        if (paramsA.num > 0)
          Log("Trace strength increased to " + traceStrength);
        else
          Log(
            "Trace strength not increased (remains at " + traceStrength + ")"
          );
        //runner link turn
        var runnerChoices = [
          { num: 0, label: "Continue without increasing link strength" },
        ];
        var i = 1;
        while (CheckCredits(i, runner, "trace")) {
          runnerChoices.push({
            num: i,
            label: i + "[c]: Increase link strength by " + i,
          });
          i++;
        }
        function decisionCallbackB(paramsB) {
          var linkStrength = Link() + paramsB.num;
          SpendCredits(
            runner,
            paramsB.num,
            "trace",
            null,
            function () {
              if (paramsB.num > 0)
                Log("Link strength increased to " + linkStrength);
              else
                Log(
                  "Link strength not increased (remains at " +
                    linkStrength +
                    ")"
                );
              var successful = traceStrength > linkStrength;
              if (successful) Log("Trace successful");
              else Log("Trace unsuccessful");
              callback.call(context, successful);
            },
            this
          );
        }
        DecisionPhase(
          runner,
          runnerChoices,
          decisionCallbackB,
          "Trace<sup>" + baseStrength + "</sup>",
          "Increase link strength (from " + Link() + ")",
          this
        );
      },
      this
    );
  }
  DecisionPhase(
    corp,
    corpChoices,
    decisionCallbackA,
    "Trace<sup>" + baseStrength + "</sup>",
    "Increase trace strength (from " + baseStrength + ")",
    this
  );
}
