//COMMANDS
//These are internal implementation functions and unlikely to be referred to in the script of a card

var log = []; //each validated command executed

/**
 * Executes a command by string.<br/>Acts as main loop in console mode.<br/>Checks agenda points for win condition.
 *
 * @method Execute
 * @param {String} cmd command string
 */
function Execute(cmd)
{
	executingCommand = cmd;
	var originalPhase = currentPhase;
	LogSubtle(TurnPhaseStr()+cmd);

	validOptions = [{}];
	if (typeof(phaseOptions[cmd]) !== 'undefined') validOptions = phaseOptions[cmd];
	if (typeof(currentPhase.Resolve[cmd]) == 'function')
	{
		MakeChoice();
	}
	else Log("\""+cmd+"\" is unknown or not permitted at this time");
}

var executingCommand = null;
var validOptions = [];
function ResolveChoice(idx)
{
	$("#modal").css("display","none");
	if ((idx < 0)||(idx>=validOptions.length))
	{
		LogError("Invalid choice made ("+idx+") of:");
		LogError(validOptions);
		return;
	}
	//store chosen option and clear validOptions to prevent accidental repeat calls
	var chosenOption = validOptions[idx];
	validOptions = [];
	//report the choice, if relevant
	if (typeof(currentPhase.chosenString) !== 'undefined')
	{
		var chosenString = currentPhase.chosenString;
		if (typeof(chosenOption.label) !== 'undefined')
		{
			if (chosenString == "triggered") Log('"'+chosenOption.label+'" '+chosenString);
			else Log(chosenOption.label+" "+chosenString);
		}
	}
	//a special case: if a card is dragged/clicked during main phase then call the parent Resolve with this as params
	if (typeof(chosenOption.card) !== 'undefined')
	{
		if (typeof(phaseOptions.play) !== 'undefined')
		{
			if (phaseOptions.play.includes(chosenOption)) executingCommand = "play";
		}
		if (typeof(phaseOptions.install) !== 'undefined')
		{
			if (phaseOptions.install.includes(chosenOption)) executingCommand = "install";
		}
		if (typeof(phaseOptions.trigger) !== 'undefined')
		{
			if (phaseOptions.trigger.includes(chosenOption)) executingCommand = "trigger";
		}
		if (typeof(phaseOptions.trash) !== 'undefined')
		{
			if (phaseOptions.trash.includes(chosenOption)) executingCommand = "trash";
		}
	}
	mainLoop = window.setTimeout(Main,mainLoopDelay); //set before execution to allow for things to clear it
	currentPhase.Resolve[executingCommand](chosenOption);
}

//return the card availability for rendering/interacting
//0 is no interaction, 1 is click to interact, 2 is drag and drop to interact, 3 is selected in a multi-select
var useHostForAvailability = false;
function GetAvailability(renderer)
{	
	//check for accessing first
	if (accessList.length > 0)
	{
		if (renderer.card === accessingCard) return -3; //special case, highlights the card being accessed
		else if ((accessList.includes(renderer.card))&&(typeof(phaseOptions.access) !== 'undefined')) return 1;
	}
	
	//if renderer is non a card, e.g. a token...
	if (typeof(renderer.card) == 'undefined')
	{
		if (renderer == countersUI.credits.runner)
		{
			if ((activePlayer==viewingPlayer)&&(activePlayer==runner))
			{
				if ((typeof(currentPhase.Resolve.gain) == 'function')&&(executingCommand=="n")) return 1; //available when listed and not mid-decision
			}
		}
		else if (renderer == countersUI.credits.corp)
		{
			if ((activePlayer==viewingPlayer)&&(activePlayer==corp))
			{
				if ((typeof(currentPhase.Resolve.gain) == 'function')&&(executingCommand=="n")) return 1; //available when listed and not mid-decision
			}
		}
		else if (renderer == countersUI.tag.runner)
		{
			if ((activePlayer==viewingPlayer)&&(activePlayer==runner))
			{
				if ((typeof(currentPhase.Resolve.remove) == 'function')&&(executingCommand=="n")&&(currentPhase.Enumerate.remove().length > 0)) return 1; //available when listed and not mid-decision
			}
		}
		else if (renderer == countersUI.hand_size.runner)
		{
			if (runner.grip.length > MaxHandSize(runner)) return -2;
		}
		else if (renderer == countersUI.hand_size.corp)
		{
			if (corp.HQ.cards.length > MaxHandSize(corp)) return -2;
		}
		return 0;
	}
	
	//special cases for cards
	if ((typeof(currentPhase.Resolve.draw) == 'function')&&(activePlayer==viewingPlayer)&&(executingCommand=="n")) //available when listed and not mid-decision
	{
		if ((activePlayer == corp)&&(renderer.card == corp.RnD.cards[corp.RnD.cards.length-1])) return 2;
		else if ((activePlayer == runner)&&(renderer.card == runner.stack[runner.stack.length-1])) return 2;
	}
	
	//check for card options in general
	for (var i=0; i<validOptions.length; i++)
	{
		var available = false;
		if (useHostForAvailability) available = (validOptions[i].host == renderer.card);
		else available = (validOptions[i].card == renderer.card);
		if (available)
		{
			//check if it is toggled on in a selection list
			if (typeof(validOptions[i].cards) !== 'undefined')
			{
				if (validOptions[i].cards.indexOf(renderer.card) > -1) return 3;
			}
			//if it is an available card in hand, you can drag the card to play it
			if (renderer.card.player == viewingPlayer)
			{
				if (renderer.card.player == runner)
				{
					if (runner.grip.includes(renderer.card)) return 2;
				}
				else if (renderer.card.player == corp)
				{
					if (corp.HQ.cards.includes(renderer.card)) return 2;
				}
			}
			//if trashing, drag a card to trash it
			if (typeof(phaseOptions.trash) !== 'undefined')
			{
				for (var j=0; j<phaseOptions.trash.length; j++)
				{
					if (phaseOptions.trash[j].card == renderer.card) return 2;
				}
			}
			//but most interaction is just being available to click
			return 1;
		}
	}
		
	return 0; //no availability
}

//resolve click with input of clicked card renderer or clicked server
function ResolveClick(input)
{
	var relevantOptions = [];
	var latestRelevantIndex;
	var uniqueCard = null;
	var renderer = input;
	var i=0;

	//clear the pointer hover (for touch support)
	if (typeof(this.pointerout) == 'function') this.pointerout();

	//if a specific clickable element (called in context of the sprite)
	if ((this == countersUI.credits.runner.sprite)||(this == countersUI.credits.corp.sprite))
	{
		if (GetAvailability(this.renderer) > 0)
		{
			ExecuteChosen("gain");
			return true; //returning true prevents any remaining code in renderer.OnClick() from firing
		}
	}
	else if (this == countersUI.tag.runner.sprite)
	{
		if (GetAvailability(this.renderer) > 0)
		{
			ExecuteChosen("remove");
			return true; //returning true prevents any remaining code in renderer.OnClick() from firing
		}
	}
	
	//specific case: draw from deck
	if ((typeof(currentPhase.Resolve.draw) == 'function')&&(activePlayer==viewingPlayer))
	{
		if (((activePlayer == corp)&&(renderer.card == corp.RnD.cards[corp.RnD.cards.length-1])&&(corp.RnD.cards.length>0))||((activePlayer == runner)&&(renderer.card == runner.stack[runner.stack.length-1])&&(runner.stack.length > 0)))
		{
			ExecuteChosen("draw");
			return true; //returning true prevents any remaining code in renderer.OnClick() from firing
		}
	}

	if (TutorialReplacer != null)
	{
		if (TutorialReplacer(input)) return true; //returning true prevents any remaining code in renderer.OnClick() from firing
	}

	if (relevantOptions.length == 0) //no selection made yet, check more possibilities
	{
		//if could choose by server, why not!
		if (OptionsAreOnlyUniqueServers()&&pixi_playThreshold())
		{
			for (i=0; i<validOptions.length; i++)
			{
				if (validOptions[i].server == input)
				{
					relevantOptions.push(validOptions[i]);
					latestRelevantIndex = i;
					break;
				}
			}
		}
		else if (OptionsAreOnlyUniqueSubroutines()) //choose by subroutine
		{
			for (i=0; i<validOptions.length; i++)
			{
				if (validOptions[i].subroutine == input)
				{
					relevantOptions.push(validOptions[i]);
					latestRelevantIndex = i;
					break;
				}
			}
		}
		else if (typeof(input.card) !== 'undefined') //valid options are not just servers, so we make a list to choose by card or host
		{			
			//check if renderer.card is found as .card in the validOptions
			for (i=0; i<validOptions.length; i++)
			{
				if (typeof(validOptions[i].card) !== 'undefined')
				{
					if (validOptions[i].card == renderer.card)
					{
						//make a list of all the reasons this card could be clicked
						var doPush = false;

						//for some actions, a server is also chosen by where the card was dragged
						if (typeof(validOptions[i].server) !== 'undefined')
						{	
							var server = validOptions[i].server;
							doPush = MouseIsOverServer(server);
						}
						//for multiple-select of cards, toggle in list and fire if .cards is full
						else if (typeof(validOptions[i].cards) !== 'undefined')
						{
							var cardIndex = validOptions[i].cards.indexOf(renderer.card);
							if (cardIndex > -1) //remove from selection
							{
								validOptions[i].cards[cardIndex] = null;
								//bump others down as needed
								for (var j=0; j<validOptions[i].cards.length-1; j++)
								{
									if (validOptions[i].cards[j] == null)
									{
										validOptions[i].cards[j] = validOptions[i].cards[j+1];
										validOptions[i].cards[j+1] = null;
									}
								}
							}
							else //add it at first null position in list
							{
								for (var j=0; j<validOptions[i].cards.length; j++)
								{
									if (validOptions[i].cards[j] == null)
									{
										validOptions[i].cards[j] = renderer.card;
										//check if last slot filled in which case this choice could fire
										if (j == validOptions[i].cards.length-1)
										{
											ResolveChoice(i);
											return true; //returning true prevents any remaining code in renderer.OnClick() from firing
										}
										//otherwise stop searching for a slot (only need to add it once)
										break;
									}
								}
							}
							//if it hasn't fired, update all the other multi-selectors of the same length
							for (var k=0; k<validOptions.length; k++)
							{
								if (typeof(validOptions[k].cards) !== 'undefined')
								{
									if (validOptions[k].cards.length == validOptions[i].cards.length)
									{
										//deep copy otherwise we end up with a shared array
										for (var l=0; l<validOptions[k].cards.length; l++)
										{
											validOptions[k].cards[l] = validOptions[i].cards[l];
										}
									}
								}
							}
						}					
						//single card non-server choice could fire
						else doPush = true;
						
						if (doPush)
						{
							relevantOptions.push(validOptions[i]);
							latestRelevantIndex = i;
						}
					}
				}
			}
		}
	}

	if (relevantOptions.length > 0) //choices narrowed but check for hosts
	{
		//if it is the only valid option with this .card or .host or .server, ResolveChoice
		if (relevantOptions.length == 1) ResolveChoice(latestRelevantIndex);
		else //otherwise > 1, need to choose from only those options
		{
			//determine the closest potential host
			var closestOption = 0; //index in relevantOptions, not validOptions
			for (var i=0; i<relevantOptions.length; i++)
			{
				//handle error gracefully
				if (typeof(relevantOptions[i].host) == 'undefined')
				{
					LogError("relevantOptions[i].host not defined for "+i+" in "+JSON.stringify(relevantOptions));
					closestOption = i; //at least this way something will fire and the game will continue
				}
				else if (relevantOptions[i].host.renderer.isClosestHost) closestOption = i;
			}
			ResolveChoice(validOptions.indexOf(relevantOptions[closestOption]));
		}
		return true; //returning true prevents any remaining code in renderer.OnClick() from firing
	}
	//this card/host/server is not a valid option, do whatever else we need instead
	return false; //returning false fires any remaining code in renderer.OnClick()
}

//Simple seeded PRNG for testing purposes (source here: https://stackoverflow.com/a/47593316)
function LCG(seed) {
    function lcg(a) {return a * 48271 % 2147483647}
    seed = seed ? lcg(seed) : lcg(Math.random());
    return function() {return (seed = lcg(seed)) / 2147483648}
}
//var rand = LCG(7);
var rand = LCG();

//Servers (list of installed corp cards)
function PrintServer(server)
{
	Log("-0 Ice-");
	for (var i=server.ice.length-1; i>-1; i--)
	{
		Log("["+i+"] "+GetTitle(server.ice[i],true));
	}
	Log("-1 In-")
	for (var i=0; i<server.root.length; i++)
	{
		Log("["+i+"] "+GetTitle(server.root[i],true));
	}
}

//Special function for seeing what's in R&D
function PrintRnD()
{
	for (var i=corp.RnD.cards.length-1; i>-1; i--)
	{
		Log("["+i+"] "+GetTitle(corp.RnD.cards[i],true));
	}
}

//Rig (list of installed runner cards)
function PrintRow(row)
{
	for (var i=0; i<row.length; i++)
	{
		Log("&nbsp;["+i+"] "+GetTitle(row[i],true));
	}
}

/**
 * Mulligan (return hand to deck, shuffle, and draw five cards).<br/>Logs the result.
 *
 * @method Mulligan
 */
function Mulligan() {
	ShuffleInto(ActivePlayerHand(),ActivePlayerDeck());
	Draw(activePlayer,5);
	IncrementPhase();
};

var phaseOptions = []; //contains all the valid/legal actions Params[] for this phase. During Main() this is regenerated by calling EnumeratePhase

/**
 * Check for card effects that would forbid a phase option.
 *
 * @method CardEffectsForbid
 * @param {String} id phase option
 * @param {Card} card specific card for which the option may be forbidden
 * @returns {Boolean} true if forbidden, false if permitted
 */
function CardEffectsForbid(id,card)
{
	var triggerName = 'cannot';
	var triggerList = ChoicesActiveTriggers(triggerName);
	//assumes all are automatic
	for (var i=0; i<triggerList.length; i++)
	{
		if (triggerList[i].card[triggerName].Resolve.call(triggerList[i].card,id,card)) return true; //at least one card effect forbids it
	}	
	return false;
}

/**
 * Regenerate phaseOptions.</br>Results are LogDebug'd.
 *
 * @method EnumeratePhase
 * @returns {choice[]} list of valid options
 */
function EnumeratePhase()
{
	validOptions = [];
	phaseOptions = [];
	for (var id in currentPhase.Resolve) {
		if (typeof(currentPhase.Resolve[id]) === "function")
		{
			phaseOptions[id] = [{}]; //by default no check required so assume one legal option, no properties
			if (typeof(currentPhase.Enumerate) !== "undefined") //if it has an inbuilt check
			{
				if (typeof(currentPhase.Enumerate[id]) === "function")
				{
					LogDebug("Enumerating "+id);
					phaseOptions[id] = currentPhase.Enumerate[id]();
				}
			}
		}
	}

	//some actions need no button (human control only)
	var noButton = [];
	if (activePlayer.AI == null)
	{
		noButton.push("gain");
		noButton.push("draw");
		noButton.push("remove");
		//create clickable cards from install/play/trigger options
		if (typeof(phaseOptions.install) !== 'undefined')
		{
			validOptions = validOptions.concat(phaseOptions.install);
			noButton.push("install");
		}
		if (typeof(phaseOptions.play) !== 'undefined')
		{
			validOptions = validOptions.concat(phaseOptions.play);
			noButton.push("play");
		}
		if (typeof(phaseOptions.trigger) !== 'undefined')
		{
			validOptions = validOptions.concat(phaseOptions.trigger);
			noButton.push("trigger");
		}
		if ((typeof(phaseOptions.trash) !== 'undefined')&&(accessingCard == null))
		{
			validOptions = validOptions.concat(phaseOptions.trash);
			noButton.push("trash");
		}
	}

	//create buttons from options
	var optionList = [];
	var comstr = "";
	var footerHtml = "";
	for (var id in phaseOptions) {
		if (phaseOptions[id].length > 0)
		{
			comstr += id+" ";
			var titleText = ' title="'+NicelyFormatCommand(id)+'"';
			if (typeof(currentPhase.text) !== 'undefined')
			{
				if (typeof(currentPhase.text[id]) !== 'undefined')
				{
					titleText = ' title="'+currentPhase.text[id]+'"';
				}
			}
			if (!noButton.includes(id))
			{
				footerHtml += '<button class="button" onclick="ExecuteChosen(\''+id+'\');"'+titleText+'>'+NicelyFormatCommand(id)+'</button>';
			}
			optionList.push(id);
		}
	}
	if (activePlayer.AI == null) //active player is human-controlled
	{
		LogDebug("Available commands: "+comstr);
		$("#footer").html(footerHtml);
		$("#footer").show();
	}
	//else $("#footer").hide();
	return optionList;
}

/**
 * Pull back from a UI selection process. Results not guaranteed.
 *
 * @method Cancel
 */
function Cancel()
{
	//special case: was choosing a subroutine
	if (OptionsAreOnlyUniqueSubroutines())
	{
		var ice = GetApproachEncounterIce();
		cardRenderer.RenderSubroutineChoices(null, []);
		if (ice)
		{
			ice.renderer.ToggleZoom();
			EnumeratePhase();
			return;
		}
	}

	//generic cases
	EnumeratePhase();
	executingCommand="n"; //i.e. act as if the previous phase was finished
	MakeChoice();
}

/**
 * Gets a user selection from validOptions.<br/>Chooses automatically if only one option.
 *
 * @method MakeChoice
 */
function MakeChoice()
{	
	if (validOptions.length < 1)
	{
		LogError ("No valid choices available");
		return;
	}

	if (validOptions.length == 1)
	{
		ResolveChoice(0);
		return;
	}

	if (activePlayer.AI != null) //active player is AI controlled
	{
		try{
			ResolveChoice(activePlayer.AI.SelectChoice(validOptions));
		} catch(e){
			LogError(e);
			Log("AI: Error executing select choice, using arbitrary option from:");
			console.log(validOptions);
			ResolveChoice(0);
		}
		return;
	}

	//show cancel button if relevant
	if (typeof(currentPhase.Cancel) !== 'undefined')
	{
		if (typeof(currentPhase.Cancel[executingCommand]) === 'function')
		{
			$("#footer").html('<button class="button" onclick="currentPhase.Cancel[executingCommand]();">Cancel</button>'); //provide a cancel button
		}
	}

	//some options are rendered as buttons anyway (not the same functionality as Cancel which reverts phase rather than being a resolution to the phase)
	var nonButtonOptions = [];
	var buttonExists = false;
	footerHtml = '';
	for (var i=0; i<validOptions.length; i++)
	{
		if (typeof(validOptions[i].button) !== 'undefined')
		{
			buttonExists = true;
			footerHtml += '<button class="button" onclick="ResolveChoice('+i+');">'+Iconify(validOptions[i].button,true)+'</button>'; //the true inverts to black
		}
		else nonButtonOptions.push(validOptions[i]);
	}

	//accessing archives (for usability)
	if ((accessList.length > 0)&&(attackedServer == corp.archives)&&(typeof(phaseOptions.access) !== 'undefined'))
	{
		footerHtml += '<button class="button" onclick="AccessAllInArchives();">Access All</button>';
	}
	
	if (footerHtml != '') $("#footer").html(footerHtml);

	//return before rendering modal if it's not required

	//only a list of unique servers/subroutines? choose by click!
	if (OptionsAreOnlyUniqueServers()) return; //skip render of modal
	if (OptionsAreOnlyUniqueSubroutines())
	{
		var ice = GetApproachEncounterIce();
		cardRenderer.RenderSubroutineChoices(ice, validOptions);
		ice.renderer.ToggleZoom();
		return; //skip render of modal
	}

	//or if there is more than one .card present in options (two options with same card count as one)
	//or a single .card but at least one button as well
	// don't render a modal, use click callbacks instead
	// if any of those cards are in a pile i.e. archives.cards, RnD.cards, stack, or heap use grid view
	var uniqueCard = null;
	for (var i=0; i<validOptions.length; i++)
	{
		if (typeof(validOptions[i].button) !== 'undefined') continue; //already rendered as a button

		if (typeof(validOptions[i].card) !== 'undefined')
		{
			if (validOptions[i].card != uniqueCard)
			{
				if ((uniqueCard != null)||buttonExists)
				{
					var useViewingGrid = false;
					for (var j=0; j<validOptions.length; j++)
					{
						if (typeof(validOptions[j].card) !== 'undefined')
						{
							if (typeof(validOptions[j].card.cardLocation) !== 'undefined')
							{
								if (validOptions[j].card.cardLocation == corp.archives.cards)
								{
									if (corp.archives.cards[corp.archives.cards.length-1] != validOptions[j].card) useViewingGrid = true; //top card ok but others obscured
								}
								else if (validOptions[j].card.cardLocation == corp.RnD.cards)
								{
									if (corp.RnD.cards[corp.RnD.cards.length-1] != validOptions[j].card) useViewingGrid = true; //top card ok but others obscured
								}
								else if (validOptions[j].card.cardLocation == runner.heap) useViewingGrid = true;
								else if (validOptions[j].card.cardLocation == runner.stack) useViewingGrid = true;
							}
						}
					}
					if (useViewingGrid)
					{
						viewingGrid = [];
						for (var j=0; j<validOptions.length; j++)
						{
							var includeInViewingGrid = true;
							//don't include buttons in viewing grid
							if (typeof(validOptions[j].button) !== 'undefined') includeInViewingGrid = false;
							//don't include cards from root
							var cardServer = GetServer(validOptions[j].card);
							if (cardServer !== null)
							{
								if (validOptions[j].card.cardLocation == cardServer.root) includeInViewingGrid = false;
							}
							if (includeInViewingGrid) viewingGrid.push(validOptions[j].card);
						}
					}
					
					useHostForAvailability = false;
					for (var j=0; j<validOptions.length; j++) //highlight cards
					{
						if (typeof(validOptions[j].card) !== 'undefined')
						{
							if (validOptions[j].card !== null) validOptions[j].card.renderer.UpdateGlow();
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
	var i=0;
	for (; i<validOptions.length; i++)
	{
		if (typeof(validOptions[i].button) !== 'undefined') continue; //already rendered as a button
		
		if (typeof(validOptions[i].host) !== 'undefined')
		{
			if (validOptions[i].host != null)
			{
				if (typeof(validOptions[i].card) !== 'undefined')
				{
					if (validOptions[i].card != null)
					{
							if (onlyCard == null) onlyCard = validOptions[i].card;
							else if (onlyCard != validOptions[i].card) break; //all must have same card
					}
					else break;
				}
				else break;
			}
			else break;
		}
		else break;
	}
	if (i == validOptions.length) //reached end of loop, all must have .host and same .card, skip render of modal and highlight hosts
	{
		useHostForAvailability = true;
		for (var j=0; j<validOptions.length; j++) //highlight cards
		{
			validOptions[j].host.renderer.UpdateGlow();
		}
		return; 
	}

	//modal accepted. render:
	//show choices as hrefs in a modal dialog
	$("#modal").css("display","flex");
	var modalText = "";
	for (var i=0; i<validOptions.length; i++)
	{
		if (typeof(validOptions[i].button) !== 'undefined') continue; //already rendered as a button
		
		modalText += '<p onclick="ResolveChoice('+i+');">'+Iconify(validOptions[i].label)+'</p>\n';
	}
	$("#modalcontent").html(modalText);
}