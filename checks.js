//CHECKS
//These are GAME MECHANIC checks (not internal execution checks) and take inputs that make sense in terms of the game e.g. card object, server object, integer value

/**
 * Check whether an installed card can be advanced.
 *
 * @method CheckAdvance
 * @param {Card} card the card to check
 * @returns {Boolean} true if card can be advanced, false if not
 */
function CheckAdvance(card) {
  if (card != null) {
    if (card.canBeAdvanced) {
      return true;
    }
    return false;
  }
  return false;
}

/**
 * Check whether an installed card can be rezzed.
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
          return false;
        }
      }
      if (typeof card.rezCost !== "undefined") {
        //only check if it has a rez cost, doesn't check whether we have the credits for it
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks whether the player is in action phase and has at least the required clicks remaining.
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
    return false;
  }
  //check quantity remaining
  if (player.clickTracker < num) {
    return false;
  }
  return true;
}

/**
 * Checks whether the runner is accessing a card.
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
 * Checks whether the player has at least the required clicks remaining (does not require action phase or set checkedClick).
 *
 * @method CheckClicks
 * @param {Player} player to check clicks for
 * @param {int} num number of clicks required
 * @returns {Boolean} true if check passes, false if not
 */
function CheckClicks(player, num) {
  if (player.clickTracker < num) {
    return false;
  }
  return true;
}

/**
 * Checks whether a card has at least the required counters.
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
    return false;
  }
  return true;
}

/**
 * Checks whether the player has at least the required credits in their pool.
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
    return false;
  }
  return true;
}

/**
 * Checks whether the runner has at least the required number of tags.
 *
 * @method CheckTags
 * @param {int} num number of tags required
 * @returns {Boolean} true if check passes, false if not
 */
function CheckTags(num) {
  if (runner.tags >= num) {
    return true;
  }
  return false;
}

/**
 * Checks whether a card has any of a list of card types.
 *
 * @method CheckCardType
 * @param {Card} card to check type for
 * @param {String[]} valid array of card type strings to check against
 * @returns {Boolean} true if card contains one of the types in valid, false if not
 */
function CheckCardType(card, valid) {
  for (var i = 0; i < valid.length; i++) {
    if (card.cardType == valid[i]) {
      return true;
    }
  }
  var outstr = "Card type must be ";
  for (var i = 0; i < valid.length; i++) {
    outstr += valid[i];
    if (i < valid.length - 2) outstr += ", ";
    else if (i < valid.length - 1) outstr += " or ";
  }
  outstr += " (" + card.title + " is " + card.cardType + ")";
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
 * Check if strength of a card is sufficient to interact with the currently encountered ice.
 *
 * @method CheckStrength
 * @param {Card} card card object to check
 * @returns {Boolean} true if card's strength is >= encountered ice, otherwise false
 */
function CheckStrength(card) {
  if (attackedServer == null || approachIce < 0 || !encountering) {
    return false;
  }

  var cardStrength = Strength(card);
  var iceStrength = Strength(attackedServer.ice[approachIce]);
  if (card.onlyInterfaceEqualStrength) {
	if (cardStrength > iceStrength) {
      return false;
	}
  }
  if (cardStrength >= iceStrength) {
    return true;
  }
  return false;
}

/**
 * Checks if a run is in progress.
 *
 * @method CheckRunning
 * @returns {Boolean} true if a run is in progress, false otherwise
 */
function CheckRunning() {
  if (attackedServer != null) {
    return true;
  }
  return false;
}

/**
 * Checks if ice is being approached but not encountered.
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
    return true;
  }
  return false;
}

/**
 * Checks if ice is being encountered.
 *
 * @method CheckEncounter
 * @returns {Boolean} true if ice is being encountered, false otherwise
 */
function CheckEncounter() {
  //you might be tempted to check things to do with runs and approaches but don't! Encounters can be triggered outside such structures.
  if (encountering) {
    return true;
  }
  return false;
}

/**
 * Check whether a card can be trashed (ignoring costs).
 *
 * @method CheckTrash
 * @param {Card} card card object to check
 * @returns {Boolean} true if card can be trashed, false otherwise
 */
function CheckTrash(card) {
  if (card == null) {
    return false;
  }
  if (card.cardLocation == corp.archives.cards) {
    return false;
  }
  if (card.cardLocation == runner.heap) {
    return false;
  }
  if (CardEffectsForbid("trash", card)) return false; //forbidden by card effects
  return true;
}

/**
 * Checks whether a card can be installed (ignoring costs).<br/>Does not check where card is.
 *
 * @method CheckInstall
 * @param {Card} card card object to check
 * @returns {Boolean} true if card can be installed, false otherwise
 */
function CheckInstall(card) {
  //check card exists
  if (card == null) {
    return false;
  }

  //make sure card is correct type
  if (card.cardType == "operation" || card.cardType == "event") {
    return false;
  }

  return true;
}

/**
 * Checks whether a card can be played (ignoring costs).<br/>Does not check where card is.
 *
 * @method CheckPlay
 * @param {Card} card card object to check
 * @returns {Boolean} true if card can be played, false otherwise
 */
function CheckPlay(card) {
  //check card exists
  if (card == null) {
    return false;
  }

  //make sure card is correct type
  if (card.cardType != "operation" && card.cardType != "event") {
    return false;
  }

  return true;
}

/**
 * Checks whether currently encountered ice has any unbroken subroutines.
 *
 * @method CheckUnbrokenSubroutines
 * @returns {Boolean} true if there are unbroken subroutines, false otherwise
 */
function CheckUnbrokenSubroutines() {
  if (!CheckRunning()) return false;
  for (var i = 0; i < attackedServer.ice[approachIce].subroutines.length; i++) {
    if (!attackedServer.ice[approachIce].subroutines[i].broken) {
      return true;
    }
  }
  return false;
}

/**
 * Checks whether a subroutine can be broken (ignoring costs).
 *
 * @method CheckBreak
 * @param {Subroutine} subroutine the subroutine to check
 * @returns {Boolean} true if subroutine can be broken, false otherwise
 */
function CheckBreak(subroutine) {
  if (!CheckRunning()) return false;

  //check subroutine exists
  if (subroutine == null) {
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
    return false;
  }

  //and not already broken
  if (subroutine.broken) {
    return false;
  }

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
 * Checks whether a card is installed.
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
  return ret;
}

/**
 * Checks whether a card is active.
 *
 * @method CheckActive
 * @param {Card} card card object to check
 * @returns {Boolean} true if card is active, false otherwise
 */
function CheckActive(card) {
  //check card exists
  if (card == null) {
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
 * Checks whether a card callback should be called (has callback and is either active or has callbackName.availableWhenInactive).
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
  return ret;
}

/**
 * Checks whether purge is possible.
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
        return true;
      }
    }
  }
  var installedCorpCards = InstalledCards(corp);
  for (var i = 0; i < installedCorpCards.length; i++) {
    if (typeof installedCorpCards[i].virus !== "undefined") {
      if (installedCorpCards[i].virus > 0) {
        return true;
      }
    }
  }
  return false;
  */
  
  return true;
}
