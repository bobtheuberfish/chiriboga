//COMMANDS
//These are internal implementation functions and unlikely to be referred to in the script of a card

var log = []; //each validated command executed

/**
 * Executes a command by string.<br/>Acts as main loop in console mode.<br/>Checks agenda points for win condition.
 *
 * @method Execute
 * @param {String} cmd command string
 */
function Execute(cmd) {
  executingCommand = cmd;
  var originalPhase = currentPhase;

  if (typeof(TutorialCommandMessage[cmd]) !== 'undefined') TutorialMessage(TutorialCommandMessage[cmd]);

  validOptions = [];
  if (typeof phaseOptions[cmd] !== "undefined") {
	for (var i=0; i<phaseOptions[cmd].length; i++) {
	  var isValid = true;
	  var thisOption = phaseOptions[cmd][i];
      //check tutorial black/whitelist
      if (TutorialWhitelist !== null) { //use an actions whitelist
  	    if (!TutorialWhitelist.includes(thisOption) && !TutorialWhitelist.includes(thisOption.card) && !TutorialWhitelist.includes(thisOption.server)) isValid=false; //not allowed by whitelist
      }
      if (TutorialBlacklist !== null) { //use an actions blacklist
 	    if (TutorialBlacklist.includes(thisOption) || TutorialBlacklist.includes(thisOption.card) || TutorialBlacklist.includes(thisOption.server)) isValid=false; //not allowed by blacklist
      }
	  if (isValid) validOptions.push(thisOption);
	}
  }
  if (validOptions.length == 0) validOptions = [{}];

  if (typeof currentPhase.Resolve[cmd] == "function") {
    MakeChoice();
  } else Log('"' + cmd + '" is unknown or not permitted at this time');
}

var executingCommand = null;
var validOptions = [];
function ResolveChoice(idx) {
  $("#modal").css("display", "none");
  if (idx < 0 || idx >= validOptions.length) {
    LogError("Invalid choice made (" + idx + ") of:");
    LogError(validOptions);
    return;
  }
  //store chosen option and clear validOptions to prevent accidental repeat calls
  var chosenOption = validOptions[idx];
  validOptions = [];
  //report the choice, if relevant
  if (typeof currentPhase.chosenString !== "undefined") {
    var chosenString = currentPhase.chosenString;
    if (typeof chosenOption.label !== "undefined") {
      if (chosenString == "triggered")
        Log('"' + chosenOption.label + '" ' + chosenString);
      else Log(chosenOption.label + " " + chosenString);
    }
  }
  //a special case: if a card is dragged/clicked during main phase then call the parent Resolve with this as params
  if (typeof chosenOption.card !== "undefined") {
    if (typeof phaseOptions.play !== "undefined") {
      if (phaseOptions.play.includes(chosenOption)) executingCommand = "play";
    }
    if (typeof phaseOptions.install !== "undefined") {
      if (phaseOptions.install.includes(chosenOption))
        executingCommand = "install";
    }
    if (typeof phaseOptions.trigger !== "undefined") {
      if (phaseOptions.trigger.includes(chosenOption))
        executingCommand = "trigger";
    }
    if (typeof phaseOptions.rez !== "undefined") {
      if (phaseOptions.rez.includes(chosenOption)) executingCommand = "rez";
    }
    if (typeof phaseOptions.advance !== "undefined") {
      if (phaseOptions.advance.includes(chosenOption))
        executingCommand = "advance";
    }
    if (typeof phaseOptions.trash !== "undefined") {
      if (phaseOptions.trash.includes(chosenOption)) executingCommand = "trash";
    }
    if (typeof phaseOptions.score !== "undefined") {
      //assuming we don't want to overadvance
      if (phaseOptions.score.includes(chosenOption)) executingCommand = "score";
    }
  }
  //set before execution to allow for things to clear it
  mainLoop = window.setTimeout(function(){
	//timeout completed, callback code:
	if (!Narrate(Main)) Main(); //either narrate then call Main, or if no narration just proc Main now
  }, ($('#narration').prop('checked') ? 1 : mainLoopDelay) ); 
  //note this next line happens before the code in the timeout
  //(the existence check is in case the game has ended and therefore there are no more choices)
  if (typeof currentPhase.Resolve[executingCommand] == 'function') currentPhase.Resolve[executingCommand](chosenOption);
}

//return the card availability for rendering/interacting
//0 is no interaction, 1 is click to interact, 2 is drag and drop to interact, 3 is selected in a multi-select
var useHostForAvailability = false;
function GetAvailability(renderer) {
  if (currentPhase == null) return 0; //game not loaded yet

  //special cases for tutorial blacklist
  if (TutorialBlacklist) {
	  if (TutorialBlacklist.includes(renderer.card)) return 0;
  }
	
  //check for accessing first
  if (renderer.card === accessingCard) return -3;

  //if renderer is non a card, e.g. a token...
  if (typeof renderer.card == "undefined") {
    if (renderer == countersUI.credits.runner) {
      if (activePlayer == viewingPlayer && activePlayer == runner) {
        if (
          typeof phaseOptions.gain !== 'undefined' &&
          executingCommand == "n"
        )
          return 1; //available when listed and not mid-decision
      }
    } else if (renderer == countersUI.credits.corp) {
      if (activePlayer == viewingPlayer && activePlayer == corp) {
        if (
          typeof phaseOptions.gain !== 'undefined' &&
          executingCommand == "n"
        )
          return 1; //available when listed and not mid-decision
      }
    } else if (renderer == countersUI.tag.runner) {
      if (activePlayer == viewingPlayer && activePlayer == runner) {
        if (
          typeof phaseOptions.remove !== 'undefined' &&
          executingCommand == "n" &&
          currentPhase.Enumerate.remove().length > 0
        )
          return 1; //available when listed and not mid-decision
      }
    } else if (renderer == countersUI.hand_size.runner) {
      if (runner.grip.length > MaxHandSize(runner)) return -2; //glow red
    } else if (renderer == countersUI.hand_size.corp) {
      if (corp.HQ.cards.length > MaxHandSize(corp)) return -2; //glow red
    }
    return 0;
  }

  //special cases for cards
  if (
    typeof phaseOptions.draw !== 'undefined' &&
    activePlayer == viewingPlayer &&
    executingCommand == "n"
  ) {
    //available when listed and not mid-decision
    if (
      activePlayer == corp &&
      renderer.card == corp.RnD.cards[corp.RnD.cards.length - 1]
    )
      return 2;
    else if (
      activePlayer == runner &&
      renderer.card == runner.stack[runner.stack.length - 1]
    )
      return 2;
  }

  //check for card options in general
  for (var i = 0; i < validOptions.length; i++) {
    var available = false;
    if (useHostForAvailability)
      available = validOptions[i].host == renderer.card;
    else available = validOptions[i].card == renderer.card;
    if (available) {
      //check if it is in a multi-select list (we're toggling, no dragging)
      if (typeof validOptions[i].cards !== "undefined") {
		//if it's toggled on, highlight purple to indicate that
		if (validOptions[i].cards.indexOf(renderer.card) > -1) return 3;
		else return 1;
      }
      //if it is an available card in hand, you can drag the card to play it
      if (renderer.card.player == viewingPlayer) {
        if (renderer.card.player == runner) {
          if (runner.grip.includes(renderer.card)) return 2;
        } else if (renderer.card.player == corp) {
          if (corp.HQ.cards.includes(renderer.card)) return 2;
        }
      }
      //if trashing your own card, drag a card to trash it
      if (
        typeof phaseOptions.trash !== "undefined" &&
        renderer.card.player == viewingPlayer
      ) {
        for (var j = 0; j < phaseOptions.trash.length; j++) {
          if (phaseOptions.trash[j].card == renderer.card) return 2;
        }
      }
	  //if the card is available with host option(s), drag to choose host
	  if (typeof validOptions[i].host !== "undefined") return 2;
      //if the card is available with server option(s), drag to choose server
      if (typeof validOptions[i].server !== "undefined") return 2;
	  //the above case handles Drag to R&D as long as phase.targetServerCardsOnly = true; is set
	  //but to handle drag to stack, we need this:
	  if (typeof currentPhase.text != 'undefined' 
	    && typeof currentPhase.text.continue != 'undefined'
		&& currentPhase.text.continue == 'Drag to your stack') return 2;
      //but most interaction is just being available to click
      return 1;
    }
  }

  return 0; //no availability
}

//resolve click with input of clicked card renderer or clicked server
function ResolveClick(input) {
  var relevantOptions = [];
  var latestRelevantIndex;
  var uniqueCard = null;
  var renderer = input;
  var i = 0;

  //clear the pointer hover (for touch support)
  if (typeof this.pointerout == "function") this.pointerout();

  //if a specific clickable element (called in context of the sprite)
  if (
    this == countersUI.credits.runner.sprite ||
    this == countersUI.credits.corp.sprite
  ) {
    if (GetAvailability(this.renderer) > 0) {
      ExecuteChosen("gain");
      return true; //returning true prevents any remaining code in renderer.OnClick() from firing
    }
  } else if (this == countersUI.tag.runner.sprite) {
    if (GetAvailability(this.renderer) > 0) {
      ExecuteChosen("remove");
      return true; //returning true prevents any remaining code in renderer.OnClick() from firing
    }
  }

  //specific case: draw from deck
  if (
    typeof currentPhase.Resolve.draw == "function" &&
    activePlayer == viewingPlayer &&
    renderer
  ) {
    if (
      (activePlayer == corp &&
        renderer.card == corp.RnD.cards[corp.RnD.cards.length - 1] &&
        corp.RnD.cards.length > 0) ||
      (activePlayer == runner &&
        renderer.card == runner.stack[runner.stack.length - 1] &&
        runner.stack.length > 0)
    ) {
      ExecuteChosen("draw");
      return true; //returning true prevents any remaining code in renderer.OnClick() from firing
    }
  }

  if (TutorialReplacer != null) {
    if (TutorialReplacer.call(viewingPlayer.identityCard,input)) return true; //returning true prevents any remaining code in renderer.OnClick() from firing
  }

  if (relevantOptions.length == 0) {
    //no selection made yet, check more possibilities
    //if could choose by server, why not!
    if (OptionsAreOnlyUniqueServers() && pixi_playThreshold()) {
      for (i = 0; i < validOptions.length; i++) {
        if (validOptions[i].server == input) {
          relevantOptions.push(validOptions[i]);
          latestRelevantIndex = i;
          break;
        }
      }
    } else if (OptionsAreOnlyUniqueSubroutines()) {
      //choose by subroutine
      for (i = 0; i < validOptions.length; i++) {
        if (validOptions[i].subroutine == input) {
          relevantOptions.push(validOptions[i]);
          latestRelevantIndex = i;
          break;
        }
      }
    } else if (typeof input.card !== "undefined") {
      //valid options are not just servers, so we make a list to choose by card or host
      //check if renderer.card is found as .card in the validOptions
      for (i = 0; i < validOptions.length; i++) {
        if (typeof validOptions[i].card !== "undefined") {
          if (validOptions[i].card == renderer.card) {
            //make a list of all the reasons this card could be clicked
            var doPush = false;

            //for some actions, a server is also chosen by where the card was dragged
            if (typeof validOptions[i].server !== "undefined") {
              if (GetAvailability(input.card.renderer) == 2) {
                //2 is dragging
                var server = validOptions[i].server;
                doPush = MouseIsOverServer(server);
              } else doPush = true; //need to consider more than one option
            }
            //for multiple-select of cards, toggle in list and fire if .cards is full
            else if (typeof validOptions[i].cards !== "undefined") {
              var cardIndex = validOptions[i].cards.indexOf(renderer.card);
              if (cardIndex > -1) {
                //remove from selection
                validOptions[i].cards[cardIndex] = null;
                //bump others down as needed
                for (var j = 0; j < validOptions[i].cards.length - 1; j++) {
                  if (validOptions[i].cards[j] == null) {
                    validOptions[i].cards[j] = validOptions[i].cards[j + 1];
                    validOptions[i].cards[j + 1] = null;
                  }
                }
              } //add it at first null position in list
              else {
                for (var j = 0; j < validOptions[i].cards.length; j++) {
                  if (validOptions[i].cards[j] == null) {
                    validOptions[i].cards[j] = renderer.card;
                    //check if last slot filled in which case this choice could fire
                    if (j == validOptions[i].cards.length - 1) {
                      ResolveChoice(i);
                      return true; //returning true prevents any remaining code in renderer.OnClick() from firing
                    }
                    //otherwise stop searching for a slot (only need to add it once)
                    break;
                  }
                }
              }
              //if it hasn't fired, update all the other multi-selectors of the same length
              for (var k = 0; k < validOptions.length; k++) {
				var numSelected = 0;
                if (typeof validOptions[k].cards !== "undefined") {
                  if (
                    validOptions[k].cards.length == validOptions[i].cards.length
                  ) {
                    //deep copy otherwise we end up with a shared array
                    for (var l = 0; l < validOptions[k].cards.length; l++) {
                      validOptions[k].cards[l] = validOptions[i].cards[l];
					  //numSelected is non-nulls in .cards
					  if (validOptions[k].cards[l]) numSelected++;
                    }
                  }
                }
				//update dynamic buttons
				if (typeof validOptions[k].multiSelectDynamicButtonText == "function") {
					$('#resolvechoice-'+k).html(validOptions[k].multiSelectDynamicButtonText(numSelected));
				}
				//set visibility based on enabler
				if (typeof validOptions[k].multiSelectDynamicButtonEnabler == "function") {
					if (validOptions[k].multiSelectDynamicButtonEnabler(numSelected)) $('#resolvechoice-'+k).show();
					else $('#resolvechoice-'+k).hide();
				}
              }
            }
            //single card non-server choice could fire
            else doPush = true;

            if (doPush) {
              relevantOptions.push(validOptions[i]);
              latestRelevantIndex = i;
            }
          }
        }
      }
    }
  }

  if (relevantOptions.length > 0) {
    //if it is the only valid option with this .card or .host or .server, ResolveChoice
    if (relevantOptions.length == 1) ResolveChoice(latestRelevantIndex);
    //otherwise > 1, need to choose from only those options (e.g. hosts)
    else {
      //determine whether selection can be made by closest potential host
      var closestOption = 0; //index in relevantOptions, not validOptions
      for (var i = 0; i < relevantOptions.length; i++) {
        //no host? need to manually select (by button)
        if (typeof relevantOptions[i].host == "undefined") {
		  for (var j=0; j<relevantOptions.length; j++) {
			  if (typeof relevantOptions[j].alt != 'undefined') relevantOptions[j].button = relevantOptions[j].alt;
			  else if (typeof relevantOptions[j].label != 'undefined') relevantOptions[j].button = relevantOptions[j].label;
			  else relevantOptions[j].button = "unlabelled";
		  }
		  //if all options are unique commands, label by command instead
		  if (relevantOptions.length > 1) {
			var uniqueCommands = [];
			var uniqueChecked = true;
			for (var j=0; j<relevantOptions.length; j++) {
				if ( typeof relevantOptions[j].command == 'undefined' || uniqueCommands.includes(relevantOptions[j].command) ) {
					uniqueChecked = false;
					break;
				} else {
					uniqueCommands.push(relevantOptions[j].command);
				}
			}
			//if possible, use *Usability to narrow choices (if all options have card defined, the same card, and commands - 1 Usability are defined and false)
			//otherwise, recreate phaseOptions with only these options
			if (uniqueChecked) {
				//check for unique card
				var uniqueCard = null;
				for (var j=0; j<relevantOptions.length; j++) {
					if (relevantOptions[j].card) {
						if (uniqueCard) {
							if (uniqueCard != relevantOptions[j].card) {
								//more than one .card defined i.e. not unique
								uniqueCard = null;
								break;
							}
						} else uniqueCard = relevantOptions[j].card;
					} else {
						//at least one option does not have .card i.e. there can be no unique card
						uniqueCard = null;
						break;
					}
				}
				if (uniqueCard) {
					//check usabilities
					var numberOfOptionsWithUsabilityFalse = 0;
					for (var j=0; j<relevantOptions.length; j++) {
						var cmd = relevantOptions[j].command;
						var usabilityFunc = cmd[0].toUpperCase()+cmd.substring(1)+'Usability';
						relevantOptions[j].usability = true;
						if (typeof uniqueCard[usabilityFunc] == 'function') {
							relevantOptions[j].usability = uniqueCard[usabilityFunc].call(uniqueCard);
							if (!relevantOptions[j].usability) numberOfOptionsWithUsabilityFalse++;
						}
					}
					//autoresolve based on usability, if relevant
					if (numberOfOptionsWithUsabilityFalse == uniqueCommands.length - 1) {
						for (var j=0; j<relevantOptions.length; j++) {
							if (relevantOptions[j].usability) {
								ResolveChoice(validOptions.indexOf(relevantOptions[j]));
								return true; //returning true prevents any remaining code in renderer.OnClick() from firing
							}
						}
					}
				}
				//recreate phaseOptions
				phaseOptions = [];
				for (var j=0; j<relevantOptions.length; j++) {
					var cmd = relevantOptions[j].command;
					relevantOptions[j].button = cmd.charAt(0).toUpperCase() + cmd.slice(1);
					if (typeof phaseOptions[cmd] == 'undefined') phaseOptions[cmd]=[];
					phaseOptions[cmd].push(relevantOptions[j]);
				}
			}
		  }
		  validOptions = relevantOptions;
		  MakeChoice();
		  return true; //returning true prevents any remaining code in renderer.OnClick() from firing
		  /*
          LogError(
            "relevantOptions[i].host not defined for " +
              i +
              " in " +
              JSON.stringify(relevantOptions)
          );
          closestOption = i; //at least this way something will fire and the game will continue
		  */
        } else if (relevantOptions[i].host.renderer.isClosestHost)
          closestOption = i;
      }
      ResolveChoice(validOptions.indexOf(relevantOptions[closestOption]));
    }
    return true; //returning true prevents any remaining code in renderer.OnClick() from firing
  }
  
  //maybe clicking to choose a host (cases where dragging could be confusing)
  if (typeof input.card != 'undefined' && typeof validOptions[0].card != 'undefined' && typeof validOptions[0].host != 'undefined') {
	var uniqueCard = validOptions[0].card;
	var choosingHost = true;
	var choiceIndex = 0;
	for (var i=1; i<validOptions.length; i++) {
	  if (typeof validOptions[i].card == 'undefined' || typeof validOptions[i].host == 'undefined' || validOptions[i].card != uniqueCard) {
		choosingHost = false;
		break;
	  } else if (input.card == validOptions[i].host) {
		choiceIndex = i;
	  }
	}
	if (choosingHost) {
		ResolveChoice(choiceIndex);
		return true; //returning true prevents any remaining code in renderer.OnClick() from firing
	}
  }

  //this card/host/server is not a valid option, do whatever else we need instead
  return false; //returning false fires any remaining code in renderer.OnClick()
}

//Simple seeded PRNG for testing purposes (source here: https://stackoverflow.com/a/47593316)
function LCG(seed) {
  function lcg(a) {
    return (a * 48271) % 2147483647;
  }
  seed = seed ? lcg(seed) : lcg(Math.random());
  return function () {
    return (seed = lcg(seed)) / 2147483648;
  };
}
//var rand = LCG(7);
var rand = LCG();

//Servers (list of installed corp cards)
function PrintServer(server) {
  Log("-0 Ice-");
  for (var i = server.ice.length - 1; i > -1; i--) {
    Log("[" + i + "] " + GetTitle(server.ice[i], true));
  }
  Log("-1 In-");
  for (var i = 0; i < server.root.length; i++) {
    Log("[" + i + "] " + GetTitle(server.root[i], true));
  }
}

//Special function for seeing what's in R&D
function PrintRnD() {
  for (var i = corp.RnD.cards.length - 1; i > -1; i--) {
    Log("[" + i + "] " + GetTitle(corp.RnD.cards[i], true));
  }
}

//Rig (list of installed runner cards)
function PrintRow(row) {
  for (var i = 0; i < row.length; i++) {
    Log("&nbsp;[" + i + "] " + GetTitle(row[i], true));
  }
}

/**
 * Mulligan (return hand to deck, shuffle, and draw five cards).<br/>Logs the result.
 *
 * @method Mulligan
 */
function Mulligan() {
  ShuffleInto(ActivePlayerHand(), ActivePlayerDeck());
  Draw(activePlayer, 5);
  IncrementPhase();
}

var phaseOptions = []; //contains all the valid/legal actions Params[] for this phase. During Main() this is regenerated by calling EnumeratePhase

/**
 * Check for card effects that would forbid a phase option.
 *
 * @method CardEffectsForbid
 * @param {String} id phase option
 * @param {Card} card specific card for which the option may be forbidden
 * @returns {Boolean} true if forbidden, false if permitted
 */
function CardEffectsForbid(id, card) {
  var triggerName = "modifyCannot";
  var triggerList = ChoicesActiveTriggers(triggerName);
  //assumes all are automatic
  for (var i = 0; i < triggerList.length; i++) {
    if (
      triggerList[i].card[triggerName].Resolve.call(
        triggerList[i].card,
        id,
        card
      )
    )
      return true; //at least one card effect forbids it for this card
  }
  return false;
}

/**
 * Regenerate phaseOptions.
 *
 * @method EnumeratePhase
 * @returns {choice[]} list of valid options
 */
function EnumeratePhase() {
  validOptions = [];
  phaseOptions = [];
  if (typeof currentPhase.PreEnumerate === "function") {
    currentPhase.PreEnumerate.call(currentPhase);
	currentPhase.preEnumerated = true;
    Render(); //apparently this is necessary...
  }
  if (currentPhase.deferredHistoryBreak) {
    AddHistoryBreakIfRequired(currentPhase.deferredHistoryBreak);
    currentPhase.deferredHistoryBreak = null;
  }
  var totalNumberOfOptions = 0;
  var numberOfOptionsWithUsabilityFalse = 0;
  for (var id in currentPhase.Resolve) {
    if (typeof currentPhase.Resolve[id] === "function") {
	  var actionPermitted = true;
	  if (TutorialWhitelist !== null) { //use an actions whitelist
		if (!TutorialWhitelist.includes(id)) actionPermitted = false; //not allowed by whitelist
	  }
	  if (TutorialBlacklist !== null) { //use an actions blacklist
		if (TutorialBlacklist.includes(id)) actionPermitted = false; //not allowed by blacklist
	  }
	  if (actionPermitted) {
        phaseOptions[id] = [{}]; //by default no check required so assume one legal option, no properties
        if (typeof currentPhase.Enumerate !== "undefined") {
          //if it has an inbuilt check
          if (typeof currentPhase.Enumerate[id] === "function") {
			var usabilityFunc = id[0].toUpperCase()+id.substring(1)+'Usability';
            phaseOptions[id] = currentPhase.Enumerate[id].call(currentPhase);
			//special processing for each option
			for (var j=0; j<phaseOptions[id].length; j++) {
				//label with command in case we need to distinguish later
				phaseOptions[id][j].command=id;
				//check any usability preclusion (stricter than rules)
				if (typeof phaseOptions[id][j].card != 'undefined' && phaseOptions[id][j].card != null) {
					if (typeof phaseOptions[id][j].card[usabilityFunc] == "function") {
						if (!phaseOptions[id][j].card[usabilityFunc].call(phaseOptions[id][j].card)) numberOfOptionsWithUsabilityFalse++;
					}
				}
			}
          }
        }
		totalNumberOfOptions += phaseOptions[id].length;
	  }
    }
  }

  //special case for human player usability (stricter than rules, although allow the option anyway if there are already options)
  //if the only available actions are precluded by usability functions, assume continue
  //(usability checks also help the AI but only rez for now; the check for AI is done in FullCheckRez)
  if (activePlayer.AI == null) {
	  if (numberOfOptionsWithUsabilityFalse > 0 && totalNumberOfOptions == numberOfOptionsWithUsabilityFalse+1 && typeof phaseOptions.n != 'undefined' && phaseOptions.n.length == 1) {
		console.log("All options have usability false, skipping phase");
		phaseOptions = { n:[{}] };
	  }
  }
  
  //some actions need no button (human control only)
  var noButton = [];
  if (activePlayer.AI == null) {
    noButton.push("gain");
    noButton.push("draw");
    noButton.push("remove");
    //create clickable cards from install/play/trigger options
    if (typeof phaseOptions.install !== "undefined") {
      validOptions = validOptions.concat(phaseOptions.install);
      noButton.push("install");
    }
    if (typeof phaseOptions.play !== "undefined") {
      validOptions = validOptions.concat(phaseOptions.play);
      noButton.push("play");
    }
    if (typeof phaseOptions.trigger !== "undefined") {
      validOptions = validOptions.concat(phaseOptions.trigger);
      noButton.push("trigger");
    }
    if (typeof phaseOptions.rez !== "undefined") {
      validOptions = validOptions.concat(phaseOptions.rez);
      noButton.push("rez");
    }
    if (typeof phaseOptions.advance !== "undefined") {
      validOptions = validOptions.concat(phaseOptions.advance);
      noButton.push("advance");
    }
    if (typeof phaseOptions.trash !== "undefined" && accessingCard == null) {
      validOptions = validOptions.concat(phaseOptions.trash);
      noButton.push("trash");
    }
    if (typeof phaseOptions.score !== "undefined") {
      //assuming we don't want to overadvance...
      validOptions = validOptions.concat(phaseOptions.score);
      noButton.push("score");
    }
  }
  //create buttons from options
  var optionList = [];
  var comstr = "";
  var footerHtml = "";
  var buttoned = [];
  for (var id in phaseOptions) {
    if (phaseOptions[id].length > 0) {
      comstr += id + " ";
      var titleText = ' title="' + NicelyFormatCommand(id) + '"';
      if (typeof currentPhase.text !== "undefined") {
        if (typeof currentPhase.text[id] !== "undefined") {
          titleText = ' title="' + currentPhase.text[id] + '"';
        }
      }
      if (!noButton.includes(id)) {
	    buttoned.push(id);
        footerHtml +=
          '<button id="footerbutton-'+id+'" class="button" onclick="ExecuteChosen(\'' +
          id +
          "');\"" +
          titleText +
          ">" +
          NicelyFormatCommand(id) +
          "</button>";
      }
      optionList.push(id);
    }
  }
  //if the only button is 'Continue' but there are other non-button options, include auto-continue option
  if (buttoned.length == 1 && buttoned.includes("n") && totalNumberOfOptions > 1) {
	  footerHtml += AutoContinueButtonHTML(true); //true means show even if auto is off
	  //and the timer bar
	  footerHtml = '<div id="timerbar" style="background-color:#f1f1f1; width:0%; height:3px; position:fixed; top:0px; left:0px;"></div>' + footerHtml;
  }
  //render footer
  if (activePlayer.AI == null) {
    //active player is human-controlled
    $("#footer").html(footerHtml);
    $("#footer").show();
  }
  else {
	  //AutoContinueButtonHTML will be blank if both players are AI
	  $("#footer").html('<h2 id="thinking">Thinking</h2>'+AutoContinueButtonHTML());
	  $("#footer h2").hide().fadeIn(400);
	  $("#footer").show();
  }
  //console.log(currentPhase.identifier);
  //console.log(currentPhase.title);
  //console.log(optionList);
  return optionList;
}

/**
 * Pull back from a UI selection process. Results not guaranteed.
 *
 * @method Cancel
 */
function Cancel() {
  //special case: was choosing a subroutine
  if (OptionsAreOnlyUniqueSubroutines()) {
    var ice = GetMostRelevantIce();
    cardRenderer.RenderSubroutineChoices(null, []);
    if (ice) {
      ice.renderer.ToggleZoom();
      EnumeratePhase();
      return;
    }
  }

  //generic cases
  Render(); //e.g. close any viewingGrids created for the canceled choice
  EnumeratePhase();
  executingCommand = "n"; //i.e. act as if the previous phase was finished
  //MakeChoice();
}

/**
 * Gets a user selection from validOptions.<br/>Chooses automatically if only one option.
 *
 * @method MakeChoice
 */
function MakeChoice() {
  if (validOptions.length < 1) {
    LogError("No valid choices available");
    return;
  }

  //check if all the options are duplicates
  //currently only available for the same card title, for "trigger" command with DuplicateUsability returning true
  //it is important we only do this for cards with DuplicateUsability defined
  //in case there are cards where the human or AI wants to make a manual choice
  if (validOptions.length > 1) {
	  var duplicateCheck = false;
	  var uniqueCheckTitle = '';
	  var uniqueCheckCommand = '';
	  for (var i=0; i<validOptions.length; i++) {
		  if (typeof validOptions[i].command == 'undefined') {
			duplicateCheck = false;
			break;
		  }
		  else if (validOptions[i].command != 'trigger') {
			duplicateCheck = false;
			break;
		  }
		  else if (validOptions[i].card == 'undefined') {
			duplicateCheck = false;
			break;
		  }
		  else if (validOptions[i].card == null) {
			duplicateCheck = false;
			break;
		  }
		  else if (typeof validOptions[i].card.DuplicateUsability !== 'function') {
			duplicateCheck = false;
			break;
		  }	  
		  else if (uniqueCheckCommand == '' && uniqueCheckTitle == '') {
			uniqueCheckCommand = validOptions[i].command;
			uniqueCheckTitle = validOptions[i].card.title;
			duplicateCheck = validOptions[i].card.DuplicateUsability.call(validOptions[i]);
		  }
		  else if (uniqueCheckCommand != validOptions[i].command || uniqueCheckTitle != validOptions[i].card.title ) {
			duplicateCheck = false;
			break;
		  }
	  }
	  if (duplicateCheck) {
		  ResolveChoice(0);
		  return;
	  }
  }

  //note that the AI selection occurs BEFORE autoselecting from a single option
  //this is because the AI may be specifically waiting to take an action/choice
  //and be confused when that option is not offered to it
  if (activePlayer.AI != null) {
    //active player is AI controlled
	activePlayer.AI.SelectChoice(validOptions)
	.then((result) => {
	  ResolveChoice(result);
	})
	.catch((e) => {
	  LogError(e);
	  Log("AI: Error executing select choice asynchronously, using arbitrary option from:");
	  console.log(validOptions);
	  ResolveChoice(0);
	});
    return;
  } else if (activePlayer.testAI != null) {
    //say what the AI would have done if it was playing
    console.log(
      "AI would have chosen: " +
        JSON.stringify(
          validOptions[activePlayer.testAI.SelectChoice(validOptions)]
        )
    );
  }

  if (validOptions.length == 1) {
    ResolveChoice(0);
    return;
  }

  //some options are rendered as buttons anyway (not the same functionality as Cancel which reverts phase rather than being a resolution to the phase)
  var nonButtonOptions = [];
  var buttonExists = false;
  footerHtml = "";
  for (var i = 0; i < validOptions.length; i++) {
	var styleStr = '';
	//determine dynamic button names
	if (typeof validOptions[i].multiSelectDynamicButtonText == "function") {
		//start with none selected
		validOptions[i].button = validOptions[i].multiSelectDynamicButtonText(0);
	}
	if (typeof validOptions[i].multiSelectDynamicButtonEnabler == "function") {
		//set initial enabled state to hidden, if required
		if (!validOptions[i].multiSelectDynamicButtonEnabler(0)) styleStr = 'style="display:none;" ';
	}
	//render buttons
    if (typeof validOptions[i].button !== "undefined") {
      buttonExists = true;
      footerHtml +=
        '<button class="button" '+styleStr+'id="resolvechoice-'+i+'" onclick="ResolveChoice(' +
        i +
        ');">' +
        Iconify(validOptions[i].button, true) +
        "</button>"; //the true inverts to black
    } else nonButtonOptions.push(validOptions[i]);
  }

  //accessing archives (for usability)
  if (
    attackedServer == corp.archives &&
    typeof phaseOptions.access !== "undefined"
  ) {
    footerHtml +=
      '<button class="button" onclick="AccessAllInArchives();">Access All</button>';
  }

  //show cancel button if relevant
  if (typeof currentPhase.Cancel !== "undefined" && !currentPhase.preventCancel) {
    if (typeof currentPhase.Cancel[executingCommand] === "function") {
      footerHtml +=
        '<button class="button" onclick="currentPhase.Cancel[executingCommand]();">Cancel</button>'; //provide a cancel button
    }
  }

  //some actions need advice
  if (footerHtml == "") {
    if (executingCommand == "trigger")
      footerHtml = "<h2>Choose next to trigger</h2>";
  }

  if (footerHtml != "") $("#footer").html(footerHtml);

  //return before rendering modal if it's not required

  //only buttons? then we're done.
  if (nonButtonOptions.length == 0) return; //skip render of modal

  //only a list of unique servers/subroutines? choose by click!
  if (OptionsAreOnlyUniqueServers()) return; //skip render of modal
  if (OptionsAreOnlyUniqueSubroutines()) {
    var ice = GetMostRelevantIce();
    cardRenderer.RenderSubroutineChoices(ice, validOptions);
    ice.renderer.ToggleZoom();
    return; //skip render of modal
  }

  //or if there is more than one .card present in options (two options with same card count as one)
  //or a single .card but at least one button as well
  // don't render a modal, use click callbacks instead
  // if any of those cards are in a pile i.e. archives.cards, RnD.cards, stack, or heap use grid view
  var uniqueCard = null;
  for (var i = 0; i < validOptions.length; i++) {
    if (typeof validOptions[i].button !== "undefined") continue; //already rendered as a button

    if (typeof validOptions[i].card !== "undefined") {
      if (validOptions[i].card != uniqueCard) {
        if (uniqueCard != null || buttonExists) {
          var useViewingGrid = false;
          for (var j = 0; j < validOptions.length; j++) {
            if (validOptions[j].card) {
              //i.e. defined and not null
              if (typeof validOptions[j].card.cardLocation !== "undefined") {
                if (validOptions[j].card.cardLocation == corp.archives.cards) {
                  if (
                    corp.archives.cards[corp.archives.cards.length - 1] !=
                    validOptions[j].card
                  )
                    useViewingGrid = true; //top card ok but others obscured
                } else if (
                  validOptions[j].card.cardLocation == corp.RnD.cards
                ) {
                  if (
                    corp.RnD.cards[corp.RnD.cards.length - 1] !=
                    validOptions[j].card
                  )
                    useViewingGrid = true; //top card ok but others obscured
                } else if (validOptions[j].card.cardLocation == runner.heap)
                  useViewingGrid = true;
                else if (validOptions[j].card.cardLocation == runner.stack)
                  useViewingGrid = true;
                else if (typeof runner.identityCard.setAsideCards != 'undefined' && validOptions[j].card.cardLocation == runner.identityCard.setAsideCards)
                  useViewingGrid = true;
              }
            }
          }
          if (useViewingGrid) {
            viewingGrid = [];
            for (var j = 0; j < validOptions.length; j++) {
              var includeInViewingGrid = true;
              //don't include buttons in viewing grid
              if (typeof validOptions[j].button !== "undefined")
                includeInViewingGrid = false;
              //don't include cards from root
              if (!validOptions[j].card) includeInViewingGrid = false;
              else {
                var cardServer = GetServer(validOptions[j].card);
                if (cardServer !== null) {
                  if (validOptions[j].card.cardLocation == cardServer.root)
                    includeInViewingGrid = false;
                }
              }
              if (includeInViewingGrid) viewingGrid.push(validOptions[j].card);
            }
          }

          useHostForAvailability = false;
          for (
            var j = 0;
            j < validOptions.length;
            j++ //highlight cards
          ) {
            if (typeof validOptions[j].card !== "undefined") {
              if (validOptions[j].card !== null)
                validOptions[j].card.renderer.UpdateGlow();
            }
          }
          return; //skip render of modal
        }
        uniqueCard = validOptions[i].card;
      }
    }
  }

  //or the same card present in all and all have .host (click will choose by host)
  var onlyCard = null;
  var i = 0;
  for (; i < validOptions.length; i++) {
    if (typeof validOptions[i].button !== "undefined") continue; //already rendered as a button

    if (typeof validOptions[i].host !== "undefined") {
      if (validOptions[i].host != null) {
        if (typeof validOptions[i].card !== "undefined") {
          if (validOptions[i].card != null) {
            if (onlyCard == null) onlyCard = validOptions[i].card;
            else if (onlyCard != validOptions[i].card) break; //all must have same card
          } else break;
        } else break;
      } else break;
    } else break;
  }
  if (i == validOptions.length) {
    //reached end of loop, all must have .host and same .card, skip render of modal and highlight hosts
    useHostForAvailability = true;
    for (
      var j = 0;
      j < validOptions.length;
      j++ //highlight cards
    ) {
      validOptions[j].host.renderer.UpdateGlow();
    }
    return;
  }

  //modal accepted. render:
  //show choices as hrefs in a modal dialog
  $("#modal").css("display", "flex");
  var modalText = "";
  for (var i = 0; i < validOptions.length; i++) {
    if (typeof validOptions[i].button !== "undefined") continue; //already rendered as a button

	if (validOptions[i].label == ''+parseInt(validOptions[i].label)) {
		//special case, numbers in a grid
		modalText +=
		  '<span onclick="ResolveChoice(' +
		  i +
		  ');">' +
		  Iconify(validOptions[i].label) +
		  "</span>\n";
	}
	else {		
		//normal list
		modalText +=
		  '<p onclick="ResolveChoice(' +
		  i +
		  ');">' +
		  Iconify(validOptions[i].label) +
		  "</p>\n";
	}
  }
  $("#modalcontent").html(modalText);
}
