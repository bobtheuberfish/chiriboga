//CHECKS
//These are GAME MECHANIC checks (not internal execution checks) and take inputs that make sense in terms of the game e.g. card object, server object, integer value

/**
 * Check whether an installed card can be advanced.<br/>LogDebugs the result.
 *
 * @method CheckAdvance
 * @param {Card} card the card to check
 * @returns {Boolean} true if card can be advanced, false if not
 */
function CheckAdvance(card) {
  if (card != null) {
    if (card.canBeAdvanced) {
      LogDebug(GetTitle(card) + " can be advanced");
      return true;
    }
    LogDebug(GetTitle(card) + " cannot be advanced");
    return false;
  } else LogDebug("Card not found to advance");
  return false;
}

/**
 * Check whether an installed card can be rezzed.<br/>LogDebugs the result.
 *
 * @method CheckRez
 * @param {Card} card the card to check for rez (permission check only, not cost check)
 * @param {String[]} validCardTypes array of card type strings that can be rezzed
 * @returns {Boolean} true if card can be rezzed, false if not
 */
function CheckRez(card, validCardTypes) {
  if (card != null) {
    if (CheckCardType(card, validCardTypes)) {
      if (typeof card.rezzed !== "undefined") {
        if (card.rezzed) {
          LogDebug(GetTitle(card) + " is already rezzed");
          return false;
        }
      }
      if (typeof card.rezCost !== "undefined") {
        //only check if it has a rez cost, doesn't check whether we have the credits for it
        LogDebug('"' + GetTitle(card) + '" can be rezzed');
        return true;
      } else LogDebug(GetTitle(card) + " does not have a rez cost");
    }
  } else LogDebug("Card not found to rez");
  return false;
}

/**
 * Checks whether the player is in action phase and has at least the required clicks remaining.<br/>LogDebugs the result.
 *
 * @method CheckActionClicks
 * @param {Player} player whose action phase is required
 * @param {int} num number of clicks required
 * @returns {Boolean} true if check passes, false if not
 */
function CheckActionClicks(player, num) {
  checkedClick = true;
  //clicks can only be spent during action phase (and they all have to be spent so maybe this check should not be required)
  var actionPhase = false;
  if (player == corp && currentPhase.identifier == "Corp 2.2")
    actionPhase = true;
  else if (player == runner && currentPhase.identifier == "Runner 1.3")
    actionPhase = true;
  if (!actionPhase) {
    LogDebug("Not currently in action phase");
    return false;
  }
  //check quantity remaining
  if (player.clickTracker < num) {
    LogDebug("Less than " + num + " clicks remaining");
    return false;
  }
  LogDebug("At least " + num + " clicks remaining");
  return true;
}

/**
 * Checks whether the runner is accessing a card.<br/>LogDebugs the result.
 *
 * @method CheckAccessing
 * @returns {Boolean} true if check passes, false if not
 */
function CheckAccessing() {
  if (typeof player === "undefined") player = activePlayer;
  checkedAccess = true;
  if (accessingCard == null) return false;
  return true;
}

/**
 * Checks whether the player has at least the required clicks remaining (does not require action phase or set checkedClick).<br/>LogDebugs the result.
 *
 * @method CheckClicks
 * @param {Player} player to check clicks for
 * @param {int} num number of clicks required
 * @returns {Boolean} true if check passes, false if not
 */
function CheckClicks(player, num) {
  if (player.clickTracker < num) {
    LogDebug("Less than " + num + " clicks remaining");
    return false;
  }
  LogDebug("At least " + num + " clicks remaining");
  return true;
}

/**
 * Checks whether a card has at least the required counters.<br/>LogDebugs the result.
 *
 * @method CheckCounters
 * @param {Card} card card to check
 * @param {String} counter type of counter
 * @param {int} [num] number of counters required (1 if omitted)
 * @returns {Boolean} true if check passes, false if not
 */
function CheckCounters(card, counter, num = 1) {
  var numCounters = Counters(card, counter);
  if (numCounters < num) {
    LogDebug(
      "Less than " + num + " " + counter + " counters on " + GetTitle(card)
    );
    return false;
  }
  LogDebug(
    "At least " + num + " " + counter + " counters on " + GetTitle(card)
  );
  return true;
}

/**
 * Checks whether the player has at least the required credits in their pool.<br/>LogDebugs the result.
 *
 * @method CheckCredits
 * @param {Player} player to check clicks for
 * @param {int} num number of credits required
 * @param {String} [doing] for 'recurring credit' checks
 * @param {Card} [card] for 'recurring credit' checks
 * @returns {Boolean} true if check passes, false if not
 */
function CheckCredits(player, num, doing = "", card = null) {
  var availableCred = AvailableCredits(player, doing, card); //unlike Credits(player) this includes recurring credit possibilities
  if (availableCred < num) {
    LogDebug("Less than " + num + " credits remaining");
    return false;
  }
  LogDebug("At least " + num + " credits remaining");
  return true;
}

/**
 * Checks whether the runner has at least the required number of tags.<br/>LogDebugs the result.
 *
 * @method CheckTags
 * @param {int} num number of tags required
 * @returns {Boolean} true if check passes, false if not
 */
function CheckTags(num) {
  if (runner.tags >= num) {
    LogDebug("Runner has at least " + num + " tags");
    return true;
  }
  if (num == 1) LogDebug("Runner is not tagged");
  else LogDebug("Runner has less than " + num + " tags");
  return false;
}

/**
 * Checks whether a card has any of a list of card types.</br>LogDebugs the result.
 *
 * @method CheckCardType
 * @param {Card} card to check type for
 * @param {String[]} valid array of card type strings to check against
 * @returns {Boolean} true if card contains one of the types in valid, false if not
 */
function CheckCardType(card, valid) {
  for (var i = 0; i < valid.length; i++) {
    if (card.cardType == valid[i]) {
      LogDebug('"' + GetTitle(card) + '" is card type "' + card.cardType + '"');
      return true;
    }
  }
  var outstr = "Card type must be ";
  for (var i = 0; i < valid.length; i++) {
    outstr += valid[i];
    if (i < valid.length - 2) outstr += ", ";
    else if (i < valid.length - 1) outstr += " or ";
  }
  outstr += " (" + GetTitle(card) + " is " + card.cardType + ")";
  LogDebug(outstr);
  return false;
}

/**
 * Check if a card has a certain subtype.<br/>Nothing is logged.
 *
 * @method CheckSubType
 * @param {Card} card card object to check
 * @param {String} subtype subtype to check for
 * @returns {Boolean} true if card object contains the subtype, otherwise false
 */
function CheckSubType(card, subtype) {
  if (card) {
	//from effects (assumes automatic)
	var callbackName = "modifySubTypes";
    var triggerList = ChoicesActiveTriggers(callbackName);
    for (var i = 0; i < triggerList.length; i++) {
      var mod = triggerList[i].card[callbackName].Resolve.call(
        triggerList[i].card,
        card
      );
	  if (typeof mod.add != 'undefined') {
		if (mod.add.includes(subtype)) return true;
	  }
	  if (typeof mod.remove != 'undefined') {
		if (mod.remove.includes(subtype)) return false;
	  }
	}
	//from card definition
    if (typeof card.subTypes != "undefined") {
		if (card.subTypes.includes(subtype)) return true;
	}
  }
  return false;
}

/**
 * Check if strength of a card is sufficient to interact with the currently encountered ice.<br/>LogDebugs the result.
 *
 * @method CheckStrength
 * @param {Card} card card object to check
 * @returns {Boolean} true if card's strength is >= encountered ice, otherwise false
 */
function CheckStrength(card) {
  if (attackedServer == null || approachIce < 0 || !encountering) {
    LogDebug("Not currently encountering ice");
    return false;
  }

  var cardStrength = Strength(card);
  var iceStrength = Strength(attackedServer.ice[approachIce]);
  if (card.onlyInterfaceEqualStrength) {
	if (cardStrength > iceStrength) {
      LogDebug('"' + GetTitle(card) + '" has too much strength');
      return false;
	}
  }
  if (cardStrength >= iceStrength) {
    LogDebug('"' + GetTitle(card) + '" has sufficient strength');
    return true;
  }
  LogDebug('"' + GetTitle(card) + '" has insufficient strength');
  return false;
}

/**
 * Checks if a run is in progress.<br/>LogDebugs the result.
 *
 * @method CheckRunning
 * @returns {Boolean} true if a run is in progress, false otherwise
 */
function CheckRunning() {
  if (attackedServer != null) {
    LogDebug("Currently running");
    return true;
  }
  LogDebug("Not currently running");
  return false;
}

/**
 * Checks if ice is being approached but not encountered.<br/>LogDebugs the result.
 *
 * @method CheckApproach
 * @returns {Boolean} true if ice is being approached, false otherwise
 */
function CheckApproach() {
  if (
    attackedServer != null &&
    approachIce > -1 &&
    !encountering &&
    !movement
  ) {
    LogDebug("Currently approaching ice");
    return true;
  }
  LogDebug("Not currently approaching ice");
  return false;
}

/**
 * Checks if ice is being encountered.<br/>LogDebugs the result.
 *
 * @method CheckEncounter
 * @returns {Boolean} true if ice is being encountered, false otherwise
 */
function CheckEncounter() {
  //you might be tempted to check things to do with runs and approaches but don't! Encounters can be triggered outside such structures.
  if (encountering) {
    LogDebug("Currently encountering ice");
    return true;
  }
  LogDebug("Not currently encountering ice");
  return false;
}

/**
 * Check whether a card can be trashed (ignoring costs).<br/>LogDebugs the result.
 *
 * @method CheckTrash
 * @param {Card} card card object to check
 * @returns {Boolean} true if card can be trashed, false otherwise
 */
function CheckTrash(card) {
  if (card == null) {
    LogDebug("Cannot trash null card");
    return false;
  }
  if (card.cardLocation == corp.archives.cards) {
    LogDebug("Cannot trash cards from archives");
    return false;
  }
  if (card.cardLocation == runner.heap) {
    LogDebug("Cannot trash cards from heap");
    return false;
  }
  if (CardEffectsForbid("trash", card)) return false; //forbidden by card effects
  LogDebug('"' + GetTitle(card) + '" can be trashed');
  return true;
}

/**
 * Checks whether a card can be installed (ignoring costs).<br/>Does not check where card is.<br/>LogDebugs the result.
 *
 * @method CheckInstall
 * @param {Card} card card object to check
 * @returns {Boolean} true if card can be installed, false otherwise
 */
function CheckInstall(card) {
  //check card exists
  if (card == null) {
    LogDebug("Card not found to install");
    return false;
  }

  //make sure card is correct type
  if (card.cardType == "operation" || card.cardType == "event") {
    LogDebug("Cannot install " + card.cardType + 's (try "play")');
    return false;
  }

  LogDebug("Card can be installed");
  return true;
}

/**
 * Checks whether a card can be played (ignoring costs).<br/>Does not check where card is.<br/>LogDebugs the result.
 *
 * @method CheckPlay
 * @param {Card} card card object to check
 * @returns {Boolean} true if card can be played, false otherwise
 */
function CheckPlay(card) {
  //check card exists
  if (card == null) {
    LogDebug("Card not found to play");
    return false;
  }

  //make sure card is correct type
  if (card.cardType != "operation" && card.cardType != "event") {
    LogDebug("Cannot play " + card.cardType + ' (try "install")');
    return false;
  }

  LogDebug("Card can be played");
  return true;
}

/**
 * Checks whether currently encountered ice has any unbroken subroutines.<br/>LogDebugs the result.
 *
 * @method CheckUnbrokenSubroutines
 * @returns {Boolean} true if there are unbroken subroutines, false otherwise
 */
function CheckUnbrokenSubroutines() {
  if (!CheckRunning()) return false;
  for (var i = 0; i < attackedServer.ice[approachIce].subroutines.length; i++) {
    if (!attackedServer.ice[approachIce].subroutines[i].broken) {
      LogDebug("Not all subroutines broken");
      return true;
    }
  }
  LogDebug("No unbroken subroutines");
  return false;
}

/**
 * Checks whether a subroutine can be broken (ignoring costs).<br/>LogDebugs the result.
 *
 * @method CheckBreak
 * @param {Subroutine} subroutine the subroutine to check
 * @returns {Boolean} true if subroutine can be broken, false otherwise
 */
function CheckBreak(subroutine) {
  if (!CheckRunning()) return false;

  //check subroutine exists
  if (subroutine == null) {
    LogDebug("Subroutine not found to break");
    return false;
  }

  //make sure it's on the currently encountered ice
  var srExist = false;
  for (var i = 0; i < attackedServer.ice[approachIce].subroutines.length; i++) {
    if (attackedServer.ice[approachIce].subroutines[i] == subroutine) {
      srExist = true;
      break;
    }
  }
  if (!srExist) {
    LogDebug("Subroutine must be on ice being encountered");
    return false;
  }

  //and not already broken
  if (subroutine.broken) {
    LogDebug("Subroutine already broken");
    return false;
  }

  LogDebug("Subroutine can be broken");
  return true;
}

/**
 * Checks whether currently accessed card can be stolen.<br/>Logdebugs the result.
 *
 * @method CheckSteal
 * @returns {Boolean} true if can be stolen, false otherwise (e.g. not an agenda)
 */
function CheckSteal() {
  if (typeof accessingCard === "undefined") return false;
  if (accessingCard == null) return false;
  if (accessingCard.cardType != "agenda") return false;
  if (CardEffectsForbid("steal", accessingCard)) return false; //forbidden by card effects
  return true;
}

/**
 * Checks whether a card can be scored.<br/>Logdebugs the result.
 *
 * @method CheckScore
 * @param [Boolean] ignoreRequirement set true to ignore advancement requirement
 * @returns {Boolean} true if can be scored, false otherwise (e.g. not an agenda)
 */
function CheckScore(card,ignoreRequirement=false) {
  if (card.cardType !== "agenda") return false;
  if (!ignoreRequirement) {
	  if (typeof card.advancement == "undefined") return false;
	  if (card.advancement < AdvancementRequirement(card)) return false;
  }
  if (CardEffectsForbid("score", card)) return false; //forbidden by card effects
  return true;
}

/**
 * Checks whether a card is installed.<br/>LogDebugs the result.
 *
 * @method CheckInstalled
 * @param {Card} card card object to check
 * @returns {Boolean} true if card is installed, false otherwise
 */
function CheckInstalled(card) {
  var ret = false;
  if (typeof card.host !== "undefined") {
    //hosted cards are assumed to be installed by default
    if (card.host != null) ret = true;
  }
  if (card.player == corp) {
    if (card.cardLocation == corp.RnD.root) ret = true;
    else if (card.cardLocation == corp.RnD.ice) ret = true;
    else if (card.cardLocation == corp.HQ.root) ret = true;
    else if (card.cardLocation == corp.HQ.ice) ret = true;
    else if (card.cardLocation == corp.archives.root) ret = true;
    else if (card.cardLocation == corp.archives.ice) ret = true;
    else {
      for (var i = 0; i < corp.remoteServers.length; i++) {
        if (card.cardLocation == corp.remoteServers[i].root) ret = true;
        else if (card.cardLocation == corp.remoteServers[i].ice) ret = true;
      }
    }
  } else if (card.player == runner) {
    if (card.cardLocation == runner.rig.programs) ret = true;
    else if (card.cardLocation == runner.rig.hardware) ret = true;
    else if (card.cardLocation == runner.rig.resources) ret = true;
  }
  if (ret == true) LogDebug(GetTitle(card) + " is installed");
  else LogDebug(GetTitle(card) + " is not installed");
  return ret;
}

/**
 * Checks whether a card is active.<br/>LogDebugs the result.
 *
 * @method CheckActive
 * @param {Card} card card object to check
 * @returns {Boolean} true if card is active, false otherwise
 */
function CheckActive(card) {
  //check card exists
  if (card == null) {
    LogDebug("Card not found to check");
    return false;
  }

  var ret = false;
  if (card.player == corp) {
    if (CheckInstalled(card)) ret = card.rezzed;
    else if (card.cardLocation == corp.scoreArea) ret = true;
    else if (card == corp.identityCard) ret = true;
    else if (card.cardLocation == corp.resolvingCards) ret = true;
  } else if (card.player == runner) {
    if (CheckInstalled(card)) ret = true;
    else if (card == runner.identityCard) ret = true;
    else if (card.cardLocation == runner.resolvingCards) ret = true;
  } else {
    LogError(GetTitle(card) + " does not have .player set");
    return false;
  }

  if (ret == true) LogDebug(GetTitle(card) + " is active");
  else LogDebug(GetTitle(card) + " is not active");
  return ret;
}

/**
 * Checks whether a card is permitted to have abilities (returns false if a 'loses all abilities' applies).
 *
 * @method CheckHasAbilities
 * @param {Card} card card object to check
 * @returns {Boolean} true if card can have abilities, false otherwise
 */
function CheckHasAbilities(card) {
	//from effects (assumes automatic)
	var callbackName = "modifyHasAbilities";
    var triggerList = ChoicesActiveTriggers(callbackName);
    for (var i = 0; i < triggerList.length; i++) {
      if (!triggerList[i].card[callbackName].Resolve.call(
        triggerList[i].card,
        card
      )) return false;
	}
	return true;
}

/**
 * Checks whether a card callback should be called (has callback and is either active or has callbackName.availableWhenInactive).<br/>LogDebugs the result.
 *
 * @method CheckCallback
 * @param {Card} card card object to check
 * @param {String} callbackName callback name to check
 * @returns {Boolean} true if card is should be called, false otherwise
 */
function CheckCallback(card, callbackName) {
  var ret = false;
  if (typeof card[callbackName] !== "undefined") {
    if (
      CheckActive(card) || card[callbackName].availableWhenInactive || 
      (callbackName == "automaticOnAccess" && card == accessingCard) ||
      (callbackName == "responseOnAccess" && card == accessingCard) ||
      (callbackName == "responseOnStolen" && card == intended.steal)
    ) {
	  //to prevent infinite loop, canHaveAbilities is assumed true when checking modifyHasAbilities
	  var canHaveAbilities = true;
	  if (callbackName != "modifyHasAbilities") canHaveAbilities = CheckHasAbilities(card);
	  if ( canHaveAbilities || card[callbackName].availableWhenInactive ) ret = true;
	}
  }
  if (ret == true)
    LogDebug(GetTitle(card) + " has valid " + callbackName + " available");
  else
    LogDebug(
      GetTitle(card) + " does not have valid " + callbackName + " available"
    );
  return ret;
}

/**
 * Checks whether purge is possible.<br/>LogDebugs the result.
 *
 * @method CheckPurge
 * @returns {Boolean} true if purge is possible, false otherwise
 */
function CheckPurge() {
  //"The Corp can always use a purge effect, even if there are no virus counters currently hosted on any cards." - CR 10.1.2
  
	/*
  var installedRunnerCards = InstalledCards(runner);
  for (var i = 0; i < installedRunnerCards.length; i++) {
    if (typeof installedRunnerCards[i].virus !== "undefined") {
      if (installedRunnerCards[i].virus > 0) {
        LogDebug("There are virus counters");
        return true;
      }
    }
  }
  var installedCorpCards = InstalledCards(corp);
  for (var i = 0; i < installedCorpCards.length; i++) {
    if (typeof installedCorpCards[i].virus !== "undefined") {
      if (installedCorpCards[i].virus > 0) {
        LogDebug("There are virus counters");
        return true;
      }
    }
  }
  LogDebug("There are no virus counters");
  return false;
  */
  
  return true;
}
