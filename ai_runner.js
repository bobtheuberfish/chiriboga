//AI decisionmaking

class RunnerAI {
  _log(message) {
    //just comment this line to suppress AI log
    console.log("AI: " + message);
  }

  _cardsOkToTrashOnInstall(installedRunnerCards) {
	var okToTrash = [];
    for (var i = 0; i < installedRunnerCards.length; i++) {
      if (typeof installedRunnerCards[i].AIOkToTrash == "function") {
		  if (installedRunnerCards[i].AIOkToTrash.call(installedRunnerCards[i])) okToTrash.push(installedRunnerCards[i]);
	  }
    }
	return okToTrash;
  }

  //okToTrash is a list of cards to ignore the memory usage of
  _spareMemoryUnits(installedRunnerCards,destination=null) {
	var okToTrash = this._cardsOkToTrashOnInstall(installedRunnerCards);
	return MemoryUnits(destination) - InstalledMemoryCost(destination,okToTrash);
  }

  _installWouldExceedMU(card) {
    if (typeof card.memoryCost === "undefined") return false;
	//predetermine installed runner cards for efficiency
	var installedRunnerCards = InstalledCards(runner);
    //loop through install options. return false as soon as an option is found that doesn't exceed mu budget
    var choices = ChoicesCardInstall(card, true); //true ignores credit cost);
    for (var i = 0; i < choices.length; i++) {
      var destination = null;
      if (typeof choices[i].host !== "undefined") destination = choices[i].host;
      if (card.memoryCost <= this._spareMemoryUnits(installedRunnerCards,destination)) return false;
    }
    return true;
  }

  _copyOfCardExistsIn(title, cards, exclude = []) {
    for (var i = 0; i < cards.length; i++) {
      if (GetTitle(cards[i]) == title && !exclude.includes(cards[i]))
        return cards[i];
    }
    return null;
  }

  _uniqueCopyAlreadyInstalled(
    card //returns true if is unique and a copy already installed
  ) {
    if (!card.unique) return false; //i.e. .unique == false or undefined
    var installedCards = InstalledCards(card.player);
    for (var i = 0; i < installedCards.length; i++) {
      if (
        installedCards[i] !== card &&
        GetTitle(installedCards[i]) == GetTitle(card)
      )
        return true;
    }
    return false;
  }

  _installedCardExistsWithSubType(subtype) {
    var installedRunnerCards = InstalledCards(runner);
    for (var i = 0; i < installedRunnerCards.length; i++) {
      if (CheckSubType(installedRunnerCards[i], subtype)) return true;
    }
    return false;
  }

  _wastefulToInstall(card) {
    if (this._uniqueCopyAlreadyInstalled(card)) return true;
    if (this._installWouldExceedMU(card)) return true;
    if (
      CheckSubType(card, "Fracter") &&
      this._installedCardExistsWithSubType("Fracter")
    )
      return true;
    if (
      CheckSubType(card, "Decoder") &&
      this._installedCardExistsWithSubType("Decoder")
    )
      return true;
    if (
      CheckSubType(card, "Killer") &&
      this._installedCardExistsWithSubType("Killer")
    )
      return true;
    if (
      CheckSubType(card, "AI") &&
      (this._essentialBreakerTypesNotInHandOrArray(InstalledCards(runner))
        .length == 0 ||
        this._installedCardExistsWithSubType("AI"))
    )
      return true;
	if (typeof card.AIWastefulToInstall == 'function') {
		if (card.AIWastefulToInstall.call(card)) return true;
	}
    return false;
  }

  //accepts choices, if you want to check AIPreferredPlayChoice as well
  _wastefulToPlay(card,choices) {
	if (typeof card.AIWastefulToPlay == 'function') {
		if (card.AIWastefulToPlay.call(card)) return true;
	}
	if (choices) {
		if (typeof card.AIPreferredPlayChoice == 'function') {
			//AIPreferredPlayChoice returns -1 if preference is to not play it
			if (card.AIPreferredPlayChoice.call(card, choices) < 0) return true;
		}
	}
    return false;
  }

  //check if a matching type breaker is installed (or AI)
  //returns the matching breaker or null if none found
  _matchingBreakerInstalled(iceCard) {
    var installedRunnerCards = InstalledCards(runner);
    for (var i = 0; i < installedRunnerCards.length; i++) {
      if (CheckSubType(installedRunnerCards[i], "Icebreaker")) {
        if (BreakerMatchesIce(installedRunnerCards[i], iceCard)) return installedRunnerCards[i];
      }
    }
    return null;
  }

  //creates three groupings: ice, asset/agenda/upgrade, and operation
  _combinedCardType(str) {
    if (str == "agenda") return "asset";
    if (str == "upgrade") return "asset";
    return str;
  }

  //get cached potential or zero
  _getCachedPotential(server) {
    var result = 0;
    for (var i = 0; i < this.cachedPotentials.length; i++) {
      if (this.cachedPotentials[i].server == server)
        return this.cachedPotentials[i].potential;
    }
    return result;
  }

  //get cached complete run cost or Infinity
  _getCachedCost(server) {
    if (!this.runsEverCalculated.includes(server))
      this._calculateBestCompleteRun(server, 0, 0, 0, 0);
    var result = Infinity;
    for (var i = 0; i < this.cachedCosts.length; i++) {
      if (this.cachedCosts[i].server == server) return this.cachedCosts[i].cost;
    }
    return result;
  }

  //this function also includes known agendas that would be accessed
  //ignoreCards is an array to not include in count
  _countNewCardsThatWouldBeAccessedInRnD(depth,ignoreCards=[]) {
    var ret = 0;
    for (var i = corp.RnD.cards.length - 1; i > -1; i--) {
	  if (!ignoreCards.includes(corp.RnD.cards[i])) {
		  if (
			!corp.RnD.cards[i].knownToRunner ||
			corp.RnD.cards[i].cardType == "agenda"
		  )
			ret += 1;
	  }
      depth--;
      if (depth == 0) return ret; //no more cards to access
    }
    return ret; //reached bottom of R&D
  }
  
  //hypothesise extra HQ accesses that are worthwhile
  _additionalHQAccessValue(usingCard=null) {
	  var totalAccesses=1;
	  //passive effects:
	  var activeCards = ActiveCards(runner);
	  for (var i = 0; i < activeCards.length; i++) {
		if (typeof activeCards[i].AIAdditionalAccess == 'function') {
		  totalAccesses += activeCards[i].AIAdditionalAccess.call(activeCards[i],corp.HQ);
	    }
	  }
	  //using card
	  if (usingCard) {
		if (typeof usingCard.AIAdditionalAccess == 'function') {
		  totalAccesses += usingCard.AIAdditionalAccess.call(usingCard,corp.HQ);
	    }
	  }
	  //take into account size
	  if (totalAccesses > corp.HQ.cards.length) {
		  totalAccesses = corp.HQ.cards.length;
	  }
	  var ret = totalAccesses - 1;
	  if (ret < 0) ret = 0;
	  return ret;
  }
  
  //get an approximate measure of ice threat
  _iceThreatScore(iceCard) {
	  var ret = 3; //most common ice printed rez cost
	  if (PlayerCanLook(runner,iceCard)) {
		ret=iceCard.rezCost;
		//no threat if cannot be rezzed
        if (!iceCard.rezzed && !CheckCredits(RezCost(iceCard), corp, "rezzing", iceCard)) ret = 0;
		//reduce threat if a matching breaker is installed
		if (this._matchingBreakerInstalled(iceCard)) ret *= 0.2; //the 0.2 is arbitrary
	  } else {
	    //reduce threat if corp is poor and ice is unrezzed
	    if (!iceCard.rezzed && ret > corp.creditPool) ret=corp.creditPool;
	  }
	  //for now, assume hosted cards nullify this ice (TODO Magnet changes this and other similar Chiriboga functions)
	  if (typeof iceCard.hostedCards !== "undefined") {
		if (iceCard.hostedCards.length > 0) ret = 0;
	  }  
	  return ret;
  }
  
  //get a rough score for ice comparison (taking into account server potential)
  _iceComparisonScore(iceCard) {
	  var ret = 0;
	  var estimatedValue = 3; //most common ice printed rez cost
	  if (PlayerCanLook(runner,iceCard)) estimatedValue=iceCard.rezCost;
	  var server = GetServer(iceCard);
	  ret = runner.AI._getCachedPotential(server) * estimatedValue;
	  if (typeof iceCard.hostedCards !== "undefined")
		ret -= iceCard.hostedCards.length; //assume hosted cards weaken it
	  return ret;
  }

  constructor() {
    this.preferred = null;
    this.cardsWorthKeeping = [];
    this.runsEverCalculated = []; //used to check whether calculation is needed to return cachedCost
    this.cachedCosts = []; //for all servers, updated each time a *complete* run is calculated
    this.cachedPotentials = []; //for all servers, calculated each time "run" action is available
    this.cachedBestPath = null; //just for the most recently calculated server
    this.cachedComplete = false; //indicates whether or not cachedBestPath represents a complete or incomplete path
	this.cachedPathServer = null; //to remember which server cachedBestPath applies to
    this.rc = new RunCalculator();
    this.serverList = [];

    this.suspectedHQCards = []; //each is a { title, cardType, copies, uncertainty } object

    //teach the AI about cards (in order of priority, best first or better order of play)
    this.economyPlay = ["Sure Gamble", "Creative Commission", "Wildcat Strike"]; //cards which can be played to gain credits
    this.drawInstall = ["Verbal Plasticity"]; //cards which can be installed to draw cards
	//cards which can be installed to increase maximum hand size
	this.maxHandIncreasers = ["T400 Memory Diamond"];

    this._temporaryValueModifications = []; //set during choice-making to consider hypotheticals (normal conditions restored after choosing)
  }

  //functions to use/gain/lose info about cards in HQ
  _storedInfoAboutHQCards(
    title //returns index in this.suspectedHQCards (or -1)
  ) {
    for (var i = 0; i < this.suspectedHQCards.length; i++) {
      if (this.suspectedHQCards[i].title == title) return i;
    }
    return -1;
  }
  _infoHQScore() { //a vague heuristic used to determine how well HQ is known (roughly equivalent to a count of known cards in HQ)
    var ret = 0;
    for (var i = 0; i < this.suspectedHQCards.length; i++) {
      ret +=
        this.suspectedHQCards[i].copies *
        (1.0 - this.suspectedHQCards[i].uncertainty);
    }
    //debug log
    var debugoutput = "Suspected HQ: ";
    for (var i = 0; i < this.suspectedHQCards.length; i++) {
      debugoutput +=
        "[" +
        this.suspectedHQCards[i].copies +
        " " +
        this.suspectedHQCards[i].title +
        ", " +
        (1.0 - this.suspectedHQCards[i].uncertainty).toFixed(1) +
        " certainty]";
    }
    debugoutput += " (info HQ score: " + ret.toFixed(1) + ")";
    this._log(debugoutput);
    return ret;
  }
  GainInfoAboutHQCard(
    card //called when a known card is moved into HQ
  ) {
    var indexOfEntry = this._storedInfoAboutHQCards(card.title);
    if (indexOfEntry < 0)
      this.suspectedHQCards.push({
        title: card.title,
        cardType: card.cardType,
        copies: 1,
        uncertainty: 0,
      });
    else {
      this.suspectedHQCards[indexOfEntry].copies++;
      this.suspectedHQCards[indexOfEntry].uncertainty *= 0.5; //average between certain and whatever the other cards are (this is fairly arbitrary)
    }
  }
  GainInfoAboutHQCards(
    cards //called with the access list when access list is created
  ) {
    if (corp.HQ.cards.length < 1) return; //this shouldn't happen but it's here to avoid divide by zero

    //uncertainty depends on cards being seen vs cards in HQ and is between 0 (certain) and 1 (impossible)
    var uncertainty =
      (corp.HQ.cards.length - cards.length) / corp.HQ.cards.length;
    if (cards.length == corp.HQ.cards.length) this.suspectedHQCards = []; //simplest case is if all cards are viewed at once

    //count the number of each title in the input
    var counts = {};
    for (var i = 0; i < cards.length; i++) {
      if (counts[cards[i].title]) counts[cards[i].title]++;
      else counts[cards[i].title] = 1;
    }

    //whenever the count exceeds the number known, update the entry
    //if that card title hasn't been seen yet, add the entry
    for (var i = 0; i < cards.length; i++) {
      var indexOfEntry = this._storedInfoAboutHQCards(cards[i].title);
      if (indexOfEntry < 0)
        this.suspectedHQCards.push({
          title: cards[i].title,
          cardType: cards[i].cardType,
          copies: counts[cards[i].title],
          uncertainty: 0,
        });
      //the card is definitely there, we're looking at it
      else {
        //multi-access may create a confident count
        if (
          counts[cards[i].title] > this.suspectedHQCards[indexOfEntry].copies
        ) {
          this.suspectedHQCards[indexOfEntry].copies = counts[cards[i].title];
          if (uncertainty < this.suspectedHQCards[indexOfEntry].uncertainty)
            this.suspectedHQCards[indexOfEntry].uncertainty = uncertainty; //may become more certain, based on this fresh information
        }
        //otherwise maybe there are more copies
        else {
          //calculate the chances of there being the another copy (basically just the fraction of unknown hand over total hand size)
          var chances =
            (corp.HQ.cards.length - this._infoHQScore()) / corp.HQ.cards.length;
          var u_added = 1.0 - chances;
          var u_original = this.suspectedHQCards[indexOfEntry].uncertainty;
          var c_original = this.suspectedHQCards[indexOfEntry].copies;
          //update uncertainty to take into account both old uncertainty and the chances there actually is another of the same
          this.suspectedHQCards[indexOfEntry].uncertainty =
            (u_original * c_original + u_added) / (1.0 + c_original);
          this.suspectedHQCards[indexOfEntry].copies++;
        }
      }
    }
  }
  LoseInfoAboutHQCards(
    card,
    cardType = "" //note: just one card at a time
  ) //called when a card is rezzed in Rez(), played in Play(), stolen/scored in Steal()/Score(), trashed from HQ in Trash(), or installed (null input) in Install()
  //if cardType is 'ice' for null card, ice cards will gain uncertainty and non-ice will lose uncertainty (and vice-versa for 'non-ice')
  {
    //this approach is far from perfect (e.g. if knowledge is reset and then an already installed card is stolen, it could remove critical knowledge) but this may still be sufficient

    if (corp.HQ.cards.length == 0) {
      //since the card triggers fire after the move is made, if HQ has become empty we can clear the knowledge stack
      this.suspectedHQCards = [];
    } else if (card) {
      //known cards will reduce number known (remove entry if zero) but will not change certainty
      var indexOfEntry = this._storedInfoAboutHQCards(card.title);
      if (indexOfEntry > -1) {
        this.suspectedHQCards[indexOfEntry].copies -= 1;
        if (this.suspectedHQCards[indexOfEntry].copies <= 0)
          this.suspectedHQCards.splice(indexOfEntry, 1);
      }
    } //null cards will increase uncertainty of relevant knowns but will not change specific counts
    else {
      //this could be improved e.g. by calculating total suspected amount of cards of that type in HQ
      for (var i = 0; i < this.suspectedHQCards.length; i++) {
        var typeMatches = true; //by default, become more uncertain
        //we exempt operations from this rule because we assume installing (hence knowing the type)
        if (
          cardType !== "" &&
          this._combinedCardType(this.suspectedHQCards[i].cardType) !==
            this._combinedCardType(cardType)
        )
          typeMatches = false;
        if (typeMatches) {
          if (this.suspectedHQCards[i].uncertainty == 0)
            this.suspectedHQCards[i].uncertainty =
              1.0 / (1.0 + corp.HQ.cards.length);
          else
            this.suspectedHQCards[i].uncertainty *=
              1.0 - 1.0 / (1.0 + corp.HQ.cards.length);
        }
      }
    }
  }

  //not currently being used, but not deleted because might need it later
  _phaseCallback(optionList, choiceType) {
    //console.log(currentPhase.identifier);
  }

  //sets this.preferred to prefs and returns indexOf cmd in optionList
  //don't forget to return the result!
  _returnPreference(optionList, cmd, prefs) {
    prefs.command = cmd;
    this.preferred = prefs;
    if (optionList.indexOf(cmd) > -1) return optionList.indexOf(cmd);
    else if (optionList.indexOf("n") > -1) return optionList.indexOf("n"); //cmd might be coming up next phase
    LogError(
      'returnPreference failed to find "' +
        cmd +
        '" in this optionList with these prefs:'
    );
    console.log(optionList);
    console.log(prefs);
    return 0; //arbitrary
  }

  //meta-wrappers for run calculator (all return the best path or null if no path found)

  //for efficiency, use cached path unless none is available
  _cachedOrBestRun(server, startIceIdx) {
	  if (!this.cachedBestPath || this.cachedPathServer !== server) { //need to recalculate
		//ideally complete runs
		this._calculateBestCompleteRun(server, 0, 0, 0, 0, startIceIdx);  //0 means no credit/click/damage offset
		//but if not, use an exit strategy (incomplete run)
		if (!this.cachedBestPath) {
		  this._calculateBestExitStrategy(server, 0, 0, 0, 0, startIceIdx);  //0 means no credit/click/damage offset
		}
	  } else {
		  //remove ice before this one
		  for (var i=this.cachedBestPath.length-1; i>-1; i--) {
			if (this.cachedBestPath[i].iceIdx > startIceIdx) this.cachedBestPath.splice(i,1);
		  }
	  }
	  return this.cachedBestPath;
  }

  _calculateBestCompleteRun(
    server,
    poolCreditOffset,
	otherCreditOffset,
    clickOffset,
    damageOffset,
    startIceIdx
  ) {
    return this._calculateRunPath(
      server,
      poolCreditOffset,
	  otherCreditOffset,
      clickOffset,
      damageOffset,
      false,
      startIceIdx
    ); //false means don't include incomplete runs
  }
  _calculateBestExitStrategy(
    server,
    poolCreditOffset,
	otherCreditOffset,
    clickOffset,
    damageOffset,
    startIceIdx
  ) {
    return this._calculateRunPath(
      server,
      poolCreditOffset,
	  otherCreditOffset,
      clickOffset,
      damageOffset,
      true,
      startIceIdx
    ); //true means include incomplete runs
  }

  //wrapper for run calculator (returns null if no path found)
  _calculateRunPath(
    server,
    poolCreditOffset,
	otherCreditOffset,
    clickOffset,
    damageOffset,
    incomplete,
    startIceIdx
  ) {
	//console.error("crp "+ServerName(server)+(incomplete?" incomplete":" complete"));
    var clicks = runner.clickTracker + clickOffset;
	var poolCredits = runner.creditPool + poolCreditOffset; //just credit pool
	var otherCredits = AvailableCredits(runner) - runner.creditPool + otherCreditOffset; //sources other than credit pool
    var damageLimit = runner.grip.length + damageOffset; //(this gets updated during the run calculation if clicks is used up)
    //this works because potentials are calculated before costs in (optionList.includes("run")). Note the false here prevents an infinite loop
    if (this._getCachedPotential(server) < 2.0)
      damageLimit -= this.cardsWorthKeeping.length; //the 2.0 is arbitrary but basically don't risk stuff for lowish potential
    if (damageLimit < 0) damageLimit = 0;
	var tagLimit =
      Math.min(clicks, Math.floor(poolCredits * 0.5)) - runner.tags; //allow 1 tag for each click+2[c] remaining (pool only atm) but less if tagged (this gets updated during the run calculation)
    if (tagLimit < 0) tagLimit = 0;
    var paths = this.rc.Calculate(
      server,
      clicks,
      poolCredits,
	  otherCredits,
      damageLimit,
      tagLimit,
      incomplete,
      startIceIdx
    );
    this.cachedBestPath = null; //by default assume no paths were found
    this.cachedComplete = !incomplete;
	this.cachedPathServer = server;
    if (!this.runsEverCalculated.includes(server))
      this.runsEverCalculated.push(server);
    //update/store cached cost
    var bestpath = [];
    if (paths.length > 0) {
		bestpath = paths[paths.length - 1];
		this.cachedBestPath = bestpath;
	}
    var bestcost = Infinity;
    if (bestpath.length > 0) {
      if (typeof bestpath[bestpath.length - 1].cost !== "undefined")
        bestcost = bestpath[bestpath.length - 1].cost;
      else bestcost = this.rc.PathCost(bestpath);
    }
    var alreadyCached = false; //or consider maybe only updating cached cost for complete runs?
    for (var i = 0; i < this.cachedCosts.length; i++) {
      if (this.cachedCosts[i].server == server) {
        this.cachedCosts[i].cost = bestcost;
        alreadyCached = true;
      }
    }
    if (!alreadyCached)
      this.cachedCosts.push({ server: server, cost: bestcost });
    return this.cachedBestPath;
  }

  //returns something between [] and ["Fracter","Decoder","Killer"]
  _essentialBreakerTypesNotInArray(installedRunnerCards) {
    var breakersInstalled = [];
    for (var j = 0; j < installedRunnerCards.length; j++) {
      if (CheckSubType(installedRunnerCards[j], "Icebreaker"))
        breakersInstalled.push(installedRunnerCards[j]);
    }
    var breakerTypes = ["Fracter", "Decoder", "Killer"];
    var result = [];
    for (var j = 0; j < breakerTypes.length; j++) {
      //if this breaker type is not already installed, add it to result
      var alreadyHaveOne = false;
      for (var k = 0; k < breakersInstalled.length; k++) {
        if (CheckSubType(breakersInstalled[k], breakerTypes[j])) {
          alreadyHaveOne = true;
          break;
        }
      }
      if (!alreadyHaveOne) result.push(breakerTypes[j]);
    }
    return result;
  }

  //returns something between [] and ["Fracter","Decoder","Killer"]
  //you can override ["Fracter","Decoder","Killer"] with your own list of subtypes to check icebreakers for
  _essentialBreakerTypesNotInHandOrArray(installedRunnerCards, overrideBreakerTypes=null) {
    var breakersInHandOrInstalled = [];
    for (var j = 0; j < installedRunnerCards.length; j++) {
      if (CheckSubType(installedRunnerCards[j], "Icebreaker"))
        breakersInHandOrInstalled.push(installedRunnerCards[j]);
    }
    for (var j = 0; j < runner.grip.length; j++) {
      if (CheckSubType(runner.grip[j], "Icebreaker"))
        breakersInHandOrInstalled.push(runner.grip[j]);
    }
    var breakerTypes = ["Fracter", "Decoder", "Killer"];
	if (overrideBreakerTypes) breakerTypes = overrideBreakerTypes;
    var result = [];
    for (var j = 0; j < breakerTypes.length; j++) {
      //if this breaker type is not already in hand or installed, add it to result
      var alreadyHaveOne = false;
      for (var k = 0; k < breakersInHandOrInstalled.length; k++) {
        if (CheckSubType(breakersInHandOrInstalled[k], breakerTypes[j])) {
          alreadyHaveOne = true;
          break;
        }
      }
      if (!alreadyHaveOne) result.push(breakerTypes[j]);
    }
    return result;
  }

  //returns the first card found fulfilling this description (or an AI if needed, or null if none found)
  _icebreakerInPileNotInHandOrArray(pileToCheck,installedRunnerCards) {
    var essentialBreakerTypesNotInHandOrArray =
      this._essentialBreakerTypesNotInHandOrArray(installedRunnerCards);
    for (var j = 0; j < essentialBreakerTypesNotInHandOrArray.length; j++) {
      //need one, is there one in deck?
      for (var k = 0; k < pileToCheck.length; k++) {
        if (
          CheckSubType(
            pileToCheck[k],
            essentialBreakerTypesNotInHandOrArray[j]
          )
        ) {
          return pileToCheck[k];
        }
      }
    }
    //we need one but couldn't find it - maybe get an AI instead (if there is not already one in hand or array)
	var aiNotInHandOrArray = this._essentialBreakerTypesNotInHandOrArray(installedRunnerCards, ["AI"]);
    if (essentialBreakerTypesNotInHandOrArray.length > 0 && aiNotInHandOrArray.length > 0) {
      for (var k = 0; k < pileToCheck.length; k++) {
        if (CheckSubType(pileToCheck[k], "AI")) {
          return pileToCheck[k];
        }
      }
    }
    return null;
  }

  //check an array for cards worth keeping
  _cardsWorthKeeping(cards) {
    //subtypes to ideally have at least one of each installed:
    var atLeastOne = ["Console", "Fracter", "Decoder", "Killer"]; //list of subtypes desired
    //loop through installed runner cards - if any have this subtype then it can be removed from the list
    //could use the _installedCardExistsWithSubType helper function but this custom approach is more efficient here
    var installedRunnerCards = InstalledCards(runner);
    for (var i = 0; i < installedRunnerCards.length; i++) {
      for (var j = atLeastOne.length - 1; j > -1; j--) {
        if (CheckSubType(installedRunnerCards[i], atLeastOne[j]))
          atLeastOne.splice(j, 1);
      }
    }
	//precalculate spareMU here for efficiency
    var spareMU = this._spareMemoryUnits(installedRunnerCards);
    //loop through array to find cards worth keeping
    var ret = [];
    for (var i = 0; i < cards.length; i++) {
      var keep = false;
      var card = cards[i];
      if (!this._wastefulToInstall(card)) {
        //_wastefulToInstall makes sure we don't overwrite existing unique or exceed mu
		
        //check for any card-specific reason
		if (typeof card.AIWorthKeeping == "function") {
			if (card.AIWorthKeeping.call(card,installedRunnerCards,spareMU)) keep = true;
		}

        //some we desire atLeastOne
        for (var j = 0; j < atLeastOne.length; j++) {
          if (CheckSubType(card, atLeastOne[j])) keep = true;
        }
        //or AI or other special breaker (e.g. Botulus, Tranquilizer)
        if (CheckSubType(card, "AI") || card.AISpecialBreaker) {
          //keep unless all breaker types are already present in grip/programs
          if (
            this._essentialBreakerTypesNotInHandOrArray(installedRunnerCards)
              .length > 0
          )
            keep = true;
        }
      }
      if (keep) ret.push(card);
    }
    return ret;
  }

  _cardsInHandWorthKeeping() {
	return this._cardsWorthKeeping(runner.grip);
  }

  //returns -1 (low), 0 (neither) or 1 (high) priority
  EstimateCardPriority(card, priorityIceList) {
    //A compatible (but not yet installed) breaker is high priority
    for (var i = 0; i < priorityIceList.length; i++) {
      var iceCard = priorityIceList[i];
      if (PlayerCanLook(runner, iceCard)) {
        if (BreakerMatchesIce(card, iceCard)) {
          //console.log("Matching breaker is " + card.title);
          if (!this._matchingBreakerInstalled(iceCard)) return 1;
          //high
          else return -1; //low
        }
      }
    }
    return 0; //neither by default
  }

  //do this right after calculating run costs and priorities
  SortCardsInHandWorthKeeping() {
    //console.log("Sorting: " + JSON.stringify(this.cardsWorthKeeping));
    var high = [];
    var neither = [];
    var low = [];

    //make an ice list (either from the highest priority server or just all ice)
    var priorityIceList = [];
    if (this.serverList.length > 0) {
      //which server is highest priority?
      var highestPotential = this.serverList[0].potential;
      var highestPotentialServer = this.serverList[0].server;
      for (var i = 1; i < this.serverList.length; i++) {
        if (this.serverList[i].potential > highestPotential) {
          highestPotential = this.serverList[i].potential;
          highestPotentialServer = this.serverList[i].server;
        }
      }
      if (highestPotentialServer.ice.length > 0)
        priorityIceList = highestPotentialServer.ice;
    }
    if (priorityIceList.length == 0) {
      var installedCards = InstalledCards(corp);
      for (var i = 0; i < installedCards.length; i++) {
        if (installedCards[i].cardType == "ice")
          priorityIceList.push(installedCards[i]);
      }
    }
    //console.log("Priority ice: " + JSON.stringify(priorityIceList));

    //loop through pushing cards as high (unshift), neither or low (push) priority
    for (var i = 0; i < this.cardsWorthKeeping.length; i++) {
      var priority = this.EstimateCardPriority(
        this.cardsWorthKeeping[i],
        priorityIceList
      );
      if (priority < 0) low.push(this.cardsWorthKeeping[i]);
      else if (priority > 0) high.unshift(this.cardsWorthKeeping[i]);
      else neither.push(this.cardsWorthKeeping[i]);
    }
    this.cardsWorthKeeping = high.concat(neither).concat(low);
    //console.log("Result: " + JSON.stringify(this.cardsWorthKeeping));
  }
  
  //planning check for complete run. Returns bestpath
  //if foresight is true, the run calculation will exchange clicks for credits/cards
  _commonRunCalculationChecks(server,runEventCardToUse,foresight) {
	var poolCreditOffset = 0;
	var extraCredits = 0;
	var clickOffset = -1; //assume 1 click will be used to initiate the run
	var damageOffset = 0;
	if (foresight) { //i.e. run a click later, do prep first
		//just some arbitrary numbers now, basically numbers that might be possible
        poolCreditOffset += 3; //could look at more options depending on what's in hand etc...
        clickOffset += -1; //use an extra click for prep
        damageOffset += 3; //...but for now this at least allows a bit of planning
	}
	//triggered card abilities that modify the bonus credits (e.g. Ken Tenma)
	var activeCards = ActiveCards(runner);
    for (var i = 0; i < activeCards.length; i++) {
	    if (typeof activeCards[i].AIRunPoolCreditOffset == 'function') {
			poolCreditOffset += activeCards[i].AIRunPoolCreditOffset.call(activeCards[i],server,runEventCardToUse);
		}
	}
	//if a run event is being used, a click is needed to play it, and a card slot (reduce max damage by 1)	
    if (runEventCardToUse) {
		//playCost probably should be PlayCost (here and everywhere) but it is not implemented yet
		if (typeof runEventCardToUse.AIRunEventExtraCredits != 'undefined') {
			extraCredits += runEventCardToUse.AIRunEventExtraCredits;
			poolCreditOffset -= runEventCardToUse.playCost; //for now we assume pool credit is used to play the card
		}
		damageOffset -= 1;
	}
	//make temporary changes (I don't like this but having lots of AIRunEvent functions that are only used once...)
	var madeTemporaryChanges = false;
    if (runEventCardToUse) {
		if (typeof runEventCardToUse.AIRunEventModify == 'function') {
			madeTemporaryChanges = true;
			runEventCardToUse.AIRunEventModify.call(runEventCardToUse,server);
		}
	}	
	//do the run calculation
	var bestpath = this._calculateBestCompleteRun(server, poolCreditOffset, extraCredits, clickOffset, damageOffset);
	//restore from temporary changes
    if (madeTemporaryChanges) {
		if (typeof runEventCardToUse.AIRunEventRestore == 'function') {
			runEventCardToUse.AIRunEventRestore.call(runEventCardToUse,server);
		}
		else {
			console.error(runEventCardToUse.title+" has AIRunEventModify but is missing AIRunEventRestore");
		}
	}
	//return the result
	return bestpath;
  }

  _commonCardToInstallChecks(cardToInstall) {
	  if (cardToInstall) {
		this._log("maybe by installing "+cardToInstall.title+"?");
		var canBeInstalled = true;
		var choices = ChoicesCardInstall(cardToInstall);
		if (!CheckInstall(cardToInstall)) canBeInstalled = false;
		//this doesn't check costs
		else if (choices.length < 1) canBeInstalled = false;
		//this checks credits, mu, available hosts, etc.
		else if (
		  typeof cardToInstall.AIPreferredInstallChoice == "function"
		) {
		  if (cardToInstall.AIPreferredInstallChoice(choices) < 0)
			canBeInstalled = false; //card AI code deemed it unworthy
		}
		if (canBeInstalled && !this._wastefulToInstall(cardToInstall)) return true;
	  }
	  return false;
  }

  _maxOverDraw() {
    //max number of cards to go over max hand size
    if (runner.clickTracker > 2 && Credits(runner) > 0)
      return runner.clickTracker - 2; //ok to draw extra early in turn if not completely broke (might find good econ)
    return 0;
  }
  _currentOverDraw() {
    return runner.grip.length - MaxHandSize(runner);
  }
 
  //NEVER do this outside of _internalChoiceDetermination
  //because the caller of that function restores the values afterwards
  _SetTemporaryValueModification(obj,prop,val) {
	  //store original value
	  this._temporaryValueModifications.push({
		obj:obj,
		prop:prop,
		val:obj[prop]
	  });
	  //make change
	  obj[prop]=val;
  }
  
  _RestoreTemporaryValueModifications() {
	for (var i=0; i<this._temporaryValueModifications.length; i++) {
		var obj = this._temporaryValueModifications[i].obj;
		var prop = this._temporaryValueModifications[i].prop;
		var val = this._temporaryValueModifications[i].val;
		obj[prop]=val;
	}
	this._temporaryValueModifications = []; //clear it
  }

  //returns index of choice
  //DO NOT call this anywhere (except the one time is called, from _computeChoice)
  //otherwise temporarily modified values may not be restored
  _internalChoiceDetermination(optionList, choiceType) {
    if (optionList.length < 1) {
      LogError("No valid commands available");
      return;
    }
	
    //temporary detailed log for troublesome bugs
/*
console.log("AI making choice from:");
console.log(optionList);
console.log("With identifier="+currentPhase.identifier+" and title="+currentPhase.title+" and preferred=");
console.log(this.preferred);
*/
	
    //some callbacks fire regardless of whether a decision needs to be made (so AI can keep track of phases)
    this._phaseCallback(optionList, choiceType);

    //check for preferreds
    var ret = -1;
    if (this.preferred !== null) {
      if (choiceType == "command") {
        if (optionList.indexOf(this.preferred.command) > -1)
          return optionList.indexOf(this.preferred.command);
      }

      //special: specific option in specific phase
      if (typeof this.preferred.title !== "undefined") {
        if (this.preferred.title == currentPhase.title) {
		  if (typeof this.preferred.option !== 'undefined') {
			ret = optionList.indexOf(this.preferred.option);
		  }
		  else if (typeof this.preferred.index !== 'undefined') {
			ret = this.preferred.index;
		  }
          if ((ret > -1)&&(ret < optionList.length)) {
            this.preferred = null; //reset (don't reuse the preference)
            return ret;
          }
        }
      }

      //special: try to choose server regardless of phase
      if (typeof this.preferred.chooseServer !== "undefined") {
        for (var i = 0; i < optionList.length; i++) {
          if (optionList[i].server == this.preferred.chooseServer) {
            this.preferred = null; //reset (don't reuse the preference)
            return i;
          }
        }
      }

      //return the optionList index of the preferred option, if found
      //NOTE this will clear preferred, if a relevant preference is found
      if (typeof this.preferred.command !== "undefined") {
        var cmd = this.preferred.command;
        if (executingCommand == cmd) {
		  if (typeof this.preferred.useAsCommand != 'undefined') cmd = this.preferred.useAsCommand;
          var data = [];
          if (cmd == "run") data = [{ prop: "server", key: "serverToRun" }];
          else if (cmd == "trigger")
            data = [{ prop: "card", key: "cardToTrigger" }];
          else if (cmd == "play") data = [{ prop: "card", key: "cardToPlay" }];
          else if (cmd == "install")
            data = [
              { prop: "card", key: "cardToInstall" },
              { prop: "host", key: "hostToInstallTo" },
            ];
		  else if (cmd == "trash") data = [{ prop: "card", key: "cardToTrash" }];
          //for more examples see ai_corp.js

          if (data.length < 1)
            this._log("process missing for " + cmd + ", so...");
          else {
            //loop through optionList
            //if data includes multiple props/keys then all must match for a hit
            for (var i = 0; i < optionList.length; i++) {
              var matches = 0;
              for (var j = 0; j < data.length; j++) {
                var prop = data[j].prop;
                var key = data[j].key;
                if (typeof this.preferred[key] !== "undefined") {
                  var value = this.preferred[key];
                  if (optionList[i][prop] == value) matches++;
                  if (matches == data.length) {
                    this._log("a relevant preference has been set");
                    if (typeof this.preferred.nextPrefs !== "undefined")
                      this.preferred = this.preferred.nextPrefs;
                    //used saved next preference
                    else this.preferred = null; //reset (don't reuse the preference)
                    return i;
                  }
                }
              }
            }
          }
          console.log(optionList);
          console.log(this.preferred);
          LogError(
            "preferred option not matched with the above optionList and preferred:"
          );
          this.preferred = null; //reset (don't reuse the preference)
        }
      }
    }

    if (optionList.length == 1) return 0;

    //*** DECISIONMAKING LOGIC HERE ***

    //used for checks
    var cardToPlay = null;
    var cardToInstall = null;
    var cardToTrigger = null;

    //make hypothetical temporary modifications (these are restored after this function returns)
	
	//cards that could be played to install (e.g. with discount)
	//(this is just pre-planning, does not return anything)
	if (optionList.includes("play")) {	
		for (var i=0; i<runner.grip.length; i++) {
			cardToPlay = runner.grip[i];
			if (typeof cardToPlay.AIPlayForInstall == 'function') {
                  if (FullCheckPlay(cardToPlay)) {
                    this._SetTemporaryValueModification(cardToPlay.modifyInstallCost,'availableWhenInactive',true);
					if (!optionList.includes("install")) optionList.push("install");
					break; //this means we might not be using the best card for the job but prevents crazy incorrect stacking
                  }
			}
		}
	}

    //consider cards-worth-keeping list (to play or to install)
    this.cardsWorthKeeping = this._cardsInHandWorthKeeping();

	//check for priority econ cards (useful for making decisions)
	var priorityEcon = null;
	var priorityPriority = 0;
	for (var i=0; i<this.cardsWorthKeeping.length; i++) {
		if (this.cardsWorthKeeping[i].AIEconomyInstall > priorityPriority) {
			priorityEcon = this.cardsWorthKeeping[i];
			priorityPriority = this.cardsWorthKeeping[i].AIEconomyInstall;
		}
		else if (this.cardsWorthKeeping[i].AIEconomyPlay > priorityPriority) {
			priorityEcon = this.cardsWorthKeeping[i];
			priorityPriority = this.cardsWorthKeeping[i].AIEconomyPlay;
		}
	}

    //Possibly useful variables include: currentPhase.title, currentPhase.identifier, executingCommand, optionList

    if (currentPhase.identifier == "Runner Mulligan") {
      if (this.cardsWorthKeeping.length < 1) return 0; //mulligan
      return 1; //by default, not mulligan
    }
	
	if (currentPhase.identifier == "Runner Install") {
		//trash on install
		if (optionList.includes("trash")) {
			//check for trashable installed programs defined as OkToTrash
			var installedRunnerCards = InstalledCards(runner);
			for (var i = 0; i < installedRunnerCards.length; i++) {
				if ( CheckCardType(installedRunnerCards[i], ["program"]) && CheckTrash(installedRunnerCards[i]) ) {
					if (typeof installedRunnerCards[i].AIOkToTrash == "function") {
						if (installedRunnerCards[i].AIOkToTrash.call(installedRunnerCards[i])) {
							return this._returnPreference(optionList, "trash", {
							  cardToTrash: installedRunnerCards[i],
							});
						}
					}
				}
			}
		}
		
		if (optionList.includes("n")) {
		  return optionList.indexOf("n"); //by default don't trash
		}
	}

    if (executingCommand == "discard") {
	  //check for duplicate uniques (i.e. a copy is installed or another in hand) first
      for (var i = 0; i < optionList.length; i++) {
		if (optionList[i].card.unique) {
			if ( this._copyOfCardExistsIn(optionList[i].card.title, runner.grip, [optionList[i].card]) 
				|| this._uniqueCopyAlreadyInstalled(optionList[i].card) ) {
					this._log("I don't need more of these");
					return i;
			}
		}
  	  }
	  var alreadyHaveRunnerCards = InstalledCards(runner).concat(runner.grip);
	  //check for duplicate non-worthkeeping
      for (var i = 0; i < optionList.length; i++) {
        if (!this.cardsWorthKeeping.includes(optionList[i].card)) {
			if ( this._copyOfCardExistsIn(optionList[i].card.title, alreadyHaveRunnerCards, [optionList[i].card]) ) {
			  this._log("I don't need another one of these");
			  return i;
			}
        }
      }
	  //check for non-worthkeeping
      for (var i = 0; i < optionList.length; i++) {
        if (!this.cardsWorthKeeping.includes(optionList[i].card)) {
		  this._log("I didn't really need this anyway");
		  return i;
        }
      }
	  //check for duplicate worthkeeping
      for (var i = 0; i < optionList.length; i++) {
		if ( this._copyOfCardExistsIn(optionList[i].card.title, alreadyHaveRunnerCards, [optionList[i].card]) ) {
		  this._log("I guess I could go without an extra one of these");
		  return i;
		}
      }
	  //just discard the oldest card
	  this._log("I guess something has to go");
      return 0;
    }

    if (optionList.includes("remove")) {
      return optionList.indexOf("remove"); //by default remove
    }

    if (optionList.includes("jack")) {
      if (currentPhase.identifier == "Run 4.3" && approachIce == 0) {
        //past last ice, choosing whether to approach server
        //edge case: if Conduit is trashed during the run
        for (var i = 0; i < runner.heap.length; i++) {
          if (runner.heap[i].title == "Conduit") {
            if (runner.heap[i].runningWithThis) {
              runner.heap[i].runningWithThis = false;
              if (corp.RnD.cards[corp.RnD.cards.length - 1].knownToRunner)
                return optionList.indexOf("jack"); //jack out, the top card is already known
            }
          }
        }
        return optionList.indexOf("n"); //by default approach server
      }

      //calculate complete run path from this point
	  this._cachedOrBestRun(attackedServer, approachIce - 1);
      if (!this.cachedBestPath || !this.cachedComplete) return optionList.indexOf("jack"); //we won't make it to the server, bail out instead
      return optionList.indexOf("n"); //by default don't jack out
    }

    if (currentPhase.identifier == "Run Accessing") {
      //accessing a card
      //prioritise in order of preference
      var highestPriorityTriggerCard = null;
	  var highestPriorityTriggerValue = 0;
	  var accessctas = ChoicesTriggerableAbilities(runner, "access");
	  for (var i=0; i<accessctas.length; i++) {
		  if (accessctas[i].card) {
			  var thisCardATP = 1; //by default fire the trigger but not high priority
			  //if a priority-determining function is defined, use that
			  if (typeof accessctas[i].card.AIAccessTriggerPriority == "function") {
				  var thisCardATP = accessctas[i].card.AIAccessTriggerPriority.call(accessctas[i].card,optionList);
			  }
			  if (thisCardATP > highestPriorityTriggerValue) {
				  highestPriorityTriggerCard = accessctas[i].card;
				  highestPriorityTriggerValue = thisCardATP;
			  }
		  }
	  }
	  var prioritiseTriggerCard = null;
	  //priority > 3: card trigger preferred over steal
	  if (highestPriorityTriggerValue > 3) prioritiseTriggerCard = highestPriorityTriggerCard;
	  //priority 3: steal
      else if (optionList.includes("steal")) return optionList.indexOf("steal");
	  //assume the remaining options relate to trashing
	  else {
		  //never trash installed ambushes, even with card ability
		  var accessedCardIsInstalledAmbush = (
			  CheckSubType(accessingCard, "Ambush") &&
			  CheckInstalled(accessingCard) &&
			  optionList.includes("n")
		  );
		  if (!accessedCardIsInstalledAmbush) {
			  //priority > 2: card trigger preferred over trash cost
			  if (highestPriorityTriggerValue > 2) prioritiseTriggerCard = highestPriorityTriggerCard;
			  //priority 2: trash cost
			  else if (optionList.includes("trash")) return optionList.indexOf("trash");
			  //priority > 1: card trigger preferred over any trigger
			  else if (highestPriorityTriggerValue > 1) prioritiseTriggerCard = highestPriorityTriggerCard;
			  //priority 1: any trigger
			  else if (optionList.includes("trigger") && highestPriorityTriggerValue == 1) return optionList.indexOf("trigger");
			  //priority > 0: card trigger preferred over no trash
			  else if (highestPriorityTriggerValue > 0) prioritiseTriggerCard = highestPriorityTriggerCard;
		  }
	  }
	  //card trigger selected, return that
	  if (prioritiseTriggerCard) {
		return this._returnPreference(optionList, "trigger", {
		  cardToTrigger: prioritiseTriggerCard,
		});		  
	  }
	  //no trash
      if (optionList.includes("n")) return optionList.indexOf("n");
	  //trash, install, trigger not an option? probably just choosing next card
	  return 0;
    }

    if (currentPhase.identifier == "Run Subroutines") {
      //subroutines have choices to be made
      //console.log("AI subroutine decision");
      //console.log(optionList);
	  this._cachedOrBestRun(attackedServer, approachIce);
      if (this.cachedBestPath) {
        //requires a path to exist (whether complete or not)
		var bestpath = this.cachedBestPath;
		//the first point for the next ice (i.e. approachIce - 1) contains sr choice for this ice (the 'when moving on' decisions)
		var p = null;
		for (var i=0; i<bestpath.length; i++) {
			if (bestpath[i].iceIdx == approachIce - 1) {
				p = bestpath[i];
				break;
			}
		}
		if (p) {
          if (p.alt) {
            //if no choice data stored, dunno!
            //console.log(subroutine);
            //console.log(p.alt);
            //find the right subroutine
            for (var i = 0; i < p.alt.length; i++) {
              if (p.alt[i].srIdx == subroutine - 1) return p.alt[i].choiceIdx; //subroutine has incremented because it fired
            }
            console.error(
              "No .alt for sr " + (subroutine - 1) + "? " + JSON.stringify(bestpath)
            );
          } else console.error("No cached path .alt? " + JSON.stringify(bestpath));
        }
      }
      this._log("No acceptable path found, seeking etr");
      var sroptions = this.rc.IceAI(
        GetApproachEncounterIce(),
        AvailableCredits(corp)
      ).sr[subroutine - 1];
      for (var i = 0; i < sroptions.length; i++) {
        if (sroptions[i].includes("endTheRun")) return i;
      }
      this._log("No etr found, avoiding tags");
      for (var i = 0; i < sroptions.length; i++) {
        if (!sroptions[i].includes("tag")) return i;
      }
      //console.log("no good!");
    }

    if (currentPhase.identifier == "Run 3.1") {
      //mid-encounter
      //console.log("Mid-encounter bestpath:");
      //calculate run path from this point (the 0s mean no credit/click/damage offset)
      //ideally complete runs
      //but if not, use an exit strategy (incomplete run)
	  this._cachedOrBestRun(attackedServer, approachIce);
      var bestpath = [];
      if (this.cachedBestPath) {
        bestpath = this.cachedBestPath;
        //console.log(optionList);

        //console.log("approachIce = "+approachIce);
        //console.log("subroutine = "+subroutine);
		//console.log(JSON.stringify(bestpath));
		//the last point for this ice has all the info in it (and the first point is the start of encounter)
		var p = null;
		for (var i=bestpath.length-1; i>0; i--) {
			if (bestpath[i].iceIdx == approachIce) {
				p = bestpath[i];
				break;
			}
		}
		if (p != null) {
			if (optionList.includes("trigger") && ((p.card_str_mods.length > 0)||(p.sr_broken.length > 0)) ) {
			  //console.log("trigger");
			  //console.log(p);
			  //e.g. str up/down and break srs
			  //first we clear out any persists from previous iceIdx (don't retrigger them)
			  while (p.card_str_mods.length > 0 && p.card_str_mods[0].iceIdx != approachIce) {
				  p.card_str_mods.splice(0,1);
			  }
			  //now assume there will only be one ability possible for this card, so we just prefer the card
			  if (p.card_str_mods.length > 0 && p.card_str_mods[0].iceIdx == approachIce) {
				return this._returnPreference(optionList, "trigger", {
				  cardToTrigger: p.card_str_mods.splice(0,1)[0].use, //assumes they are added to the array in order of use, discard immediately
				});
			  }
			  else if (p.sr_broken.length > 0) {
				return this._returnPreference(optionList, "trigger", {
				  cardToTrigger: p.sr_broken[0].use, //assumes they are added to the array in order of use, keep for sr choice
				});
			  }
			  //nothing specified, don't use abilities
			  if (optionList.includes("n")) {
				  return optionList.indexOf("n");
			  }
			} else if (p.sr_broken.length > 0) {
			  //assume choosing which subroutine to break (note that multiple breaks, even with one ability, are listed separately)
			  //console.log("break");
			  //console.log(p);
			  var ice = GetApproachEncounterIce();
			  if (ice) {
				//the index in the sr array is not necessarily the index in the optionList e.g. if sr[1] is broken then options are [0,2] and index 2 will fail
				var sridx = p.sr_broken.splice(0,1)[0].idx; //assumes they are added to the array in order of use, discard immediately
				var sr = ice.subroutines[sridx];
				for (var i = 0; i < optionList.length; i++) {
				  if (optionList[i].subroutine == sr) return i;
				}
			  }
			}
			//game is asking for something unanticipated. if this happens, investigate.
			if (!optionList.includes("trigger")) {
				console.log(JSON.stringify(p));
				console.log(JSON.stringify(optionList));
				console.error("Something went wrong during path resolution (p and optionList above)");
			}
		}
		//nothing specified, do nothing
		if (optionList.includes("n")) return optionList.indexOf("n");
      }
	  //no path exists? this shouldn't happen so swing wildly
      if (optionList.includes("trigger")) return optionList.indexOf("trigger"); //by default, trigger abilities if possible
    }

    if (currentPhase.identifier == "Run 5.2" && executingCommand == "access") {
      //breaching, choose access order
      for (var i = 0; i < optionList.length; i++) {
        if (optionList[i].card.knownToRunner || optionList[i].card.rezzed) {
          //if any are known upgrades, access that first
          if (optionList[i].card.cardType == "upgrade") return i;
          //otherwise it's a known non-upgrades, access any other card first i.e. any upgrade
          else {
            if (i == 0) return 1;
            return 0;
          }
        }
      }
	  //otherwise just choose next card
	  return 0;
    }

	//check for events that can only be played in a window of opportunity
    if (optionList.includes("play")) {
		//find highest priority window of opportunity card
        var cardToPlay=null;
		var cardPriority=0;
        for (var i = 0; i < runner.grip.length; i++) {
		    if (runner.grip[i].AIPlayWhenCan) {
			  if (runner.grip[i].AIPlayWhenCan > cardPriority) {
				if (FullCheckPlay(runner.grip[i])) {
				  var playThis = true; //if no specific rules have been defined then just play it whenever you can
				  if (typeof(runner.grip[i].AIWouldPlay) == 'function') playThis = runner.grip[i].AIWouldPlay.call(runner.grip[i]);
				  if (playThis) {					
					cardToPlay=runner.grip[i];
					cardPriority=runner.grip[i].AIPlayWhenCan;
				  }
				}
			  }
		    }
		}
        if (cardToPlay) {
          this._log("there is a card I would play with a window of opportunity");
		  return this._returnPreference(optionList, "play", {
			cardToPlay: cardToPlay,
		  });
        }
    }

    //if run is an option, assess the possible runs
    if (optionList.includes("run")) {
      //keep track of extra potential from trigger abilities
      var useRedTeam = null;
      var useConduit = null;
      if (optionList.includes("trigger")) {
        var triggerChoices = ChoicesTriggerableAbilities(runner, "click");
        for (var i = 0; i < triggerChoices.length; i++) {
          if (triggerChoices[i].card.title == "Red Team")
            useRedTeam = triggerChoices[i].card;
          else if (triggerChoices[i].card.title == "Conduit")
            useConduit = triggerChoices[i].card;
        }
      }
      //go through all the servers
      this.serverList = [
        { server: corp.HQ },
        { server: corp.RnD },
        { server: corp.archives },
      ];
      this.cachedPotentials = []; //store potentials for other use
      this.cachedCosts = []; //clear costs too
      for (var i = 0; i < corp.remoteServers.length; i++) {
        this.serverList.push({ server: corp.remoteServers[i] });
      }
      for (var i = 0; i < this.serverList.length; i++) {
        var server = this.serverList[i].server;
        //determine potential value
        this.serverList[i].potential = 0;
        if (typeof server.cards !== "undefined") {
          //i.e., is central
          if (server.cards.length > 0) {
            this.serverList[i].potential = 1;
            //if top card of R&D is already known, no need to run it
            if (
              server == corp.RnD &&
              server.cards[server.cards.length - 1].knownToRunner
            ) {
              if (server.cards[server.cards.length - 1].cardType !== "agenda")
                this.serverList[i].potential = 0;
            } else if (server == corp.RnD) {
              this.serverList[i].potential = 1.0; //arbitrary number
              //make it worth a bit more if HQ is empty
              if (corp.HQ.cards.length == 0) this.serverList[i].potential = 1.5; //arbitrary number
            } else if (server == corp.archives) {
              //the more facedown cards, the more potential
              var faceDownCardsInArchives = 0;
              for (var j = 0; j < corp.archives.cards.length; j++) {
                if (!PlayerCanLook(runner, corp.archives.cards[j]))
                  faceDownCardsInArchives++;
              }
              this.serverList[i].potential = 0.2 * faceDownCardsInArchives; //the 0.2 is arbitrary
            } //server == corp.HQ
            else {
              //the less you know, the more potential
              //HQ potential = multiplier * approx chance of seeing a new card
              //console.log("("+corp.HQ.cards.length+" - "+this._infoHQScore()+") / "+corp.HQ.cards.length);
              this.serverList[i].potential =
                (1.0 * (corp.HQ.cards.length - this._infoHQScore())) /
                corp.HQ.cards.length; //the multiplier is arbitrary
              //although if there are known agendas, bump the potential up
              for (var j = 0; j < this.suspectedHQCards.length; j++) {
                if (
                  this.suspectedHQCards[j].cardType == "agenda" &&
                  this.suspectedHQCards[j].uncertainty == 0
                )
                  this.serverList[i].potential += 1; //the 1 is arbitrary
              }
              //extra potential per additional access value (but no extra potential if none to start with)
			  if (this.serverList[i].potential > 0) {
				var additionalHQAccessValue = this._additionalHQAccessValue(null); //null means even without a Run event/ability
				this.serverList[i].potential += additionalHQAccessValue*0.5; 
			  }
              //if there's just one card and it's unknown then there must be some potential
              if (
                this.serverList[i].potential < 0.5 &&
                corp.HQ.cards.length == 1 &&
                this._infoHQScore() < 0.5
              )
                this.serverList[i].potential = 0.5;
            }
          }
		  //special potential from triggers and cards
          if (useRedTeam) {
            //might get a little credit from this (the 0.5 is arbitrary)
            if (!useRedTeam.runHQ && server == corp.HQ)
              this.serverList[i].potential += 0.5;
            else if (!useRedTeam.runRnD && server == corp.RnD)
              this.serverList[i].potential += 0.5;
            else if (!useRedTeam.runArchives && server == corp.archives)
              this.serverList[i].potential += 0.5;
          }
          if (useConduit && server == corp.RnD) {
            //extra potential the deeper you can dig (except cards already known)
            var conduitDepth = Counters(useConduit, "virus") + 1;
			//ignore top card as it is not 'bonus'
            var conduitBonusCards =
              this._countNewCardsThatWouldBeAccessedInRnD(conduitDepth,[corp.RnD.cards[corp.RnD.cards.length-1]]);
            if (conduitBonusCards > 0) {
              //only use it if it gives a benefit (it still gains counters from runs with other cards either way)
              this.serverList[i].potential += conduitBonusCards - 1;
            } else useConduit = null;
            if (conduitDepth < corp.RnD.cards.length)
              this.serverList[i].potential += 0.5; //arbitrary, for being able to gain virus counters (ignore if dig reaching the bottom of R&D)
          }
        } //remote
        else {
          this.serverList[i].potential = 0; //empty has no potential
          //first and most obvious (but probably unlikely) is if an agenda is known to be there e.g. was prevented from stealing it last time it was run
          for (var j = 0; j < server.root.length; j++) {
            if (PlayerCanLook(runner, server.root[j])) {
              if (server.root[j].cardType == "agenda")
                this.serverList[i].potential +=
                  server.root[j].agendaPoints + 1.0;
              //the constant is arbitrary
              else if (server.root[j].title == "Clearinghouse")
                this.serverList[i].potential += Math.max(
                  1.0,
                  Counters(server.root[j], "advancement")
                );
              //serious danger
              else {
                //assume everything else isn't worth the effort except if there's credits on it or it's unrezzed econ
                if (!server.root[j].rezzed) {
                  //the constant is arbitrary
                  if (server.root[j].title == "Regolith Mining License")
                    this.serverList[i].potential += 1.0;
                  if (server.root[j].title == "Nico Campaign")
                    this.serverList[i].potential += 1.0;
                } else
                  this.serverList[i].potential +=
                    0.1 * Counters(server.root[j], "credits"); //the multiplier is arbitrary
              }
            } //not known to runner
            else {
              var advancement = Counters(server.root[j], "advancement");
              if (advancement > 3) this.serverList[i].potential += 1.5;
              //this value is arbitrary. After all it could be an agenda, or urtica, or clearinghouse...
              else if (advancement > 0) this.serverList[i].potential += 5.0;
              //this value is arbitrary. But this is the best time to find out before it is advanced more!
              else this.serverList[i].potential += 1.0; //possibly nothing (as above, the number is arbitrary)
            }
          }
        }

	    //extra potential from best run event (if any)
		this.serverList[i].useRunEvent = null; //by default don't use a run event
		var runEventBestExtraPotential = 0;
        if (optionList.includes("play")) {
		  for (var j=0; j<runner.grip.length; j++) {
			  if (CheckSubType(runner.grip[j], "Run")) {
				  var extraPotentialFromThisRunEvent = 0;
				  if (typeof runner.grip[j].AIRunEventExtraPotential == 'function') extraPotentialFromThisRunEvent = runner.grip[j].AIRunEventExtraPotential.call(runner.grip[j],this.serverList[i].server,this.serverList[i].potential);
				  if ( extraPotentialFromThisRunEvent > runEventBestExtraPotential ) {
					  if ( FullCheckPlay(runner.grip[j]) ) {
						  runEventBestExtraPotential = extraPotentialFromThisRunEvent;
						  this.serverList[i].useRunEvent = runner.grip[j];
					  }
				  }
			  }
		  }
	    }
		this.serverList[i].potential += runEventBestExtraPotential;

		//cache server potential
        this.cachedPotentials.push({
          server: this.serverList[i].server,
          potential: this.serverList[i].potential,
        }); //store potential for other use (costs are cached in _calculateRunPath)
        //console.log(this.cachedPotentials[this.cachedPotentials.length-1].server.serverName+": "+this.cachedPotentials[this.cachedPotentials.length-1].potential);

        //and calculate best path
		var bestpath = this._commonRunCalculationChecks(this.serverList[i].server,this.serverList[i].useRunEvent,false); //the false is for foresight, i.e. run now not later
        this.serverList[i].bestpath = bestpath;
		this.serverList[i].bestcost = Infinity;
        if (bestpath && bestpath.length > 0) {
          if (typeof bestpath[bestpath.length - 1].cost !== "undefined") //end point of path has total cost
            this.serverList[i].bestcost = bestpath[bestpath.length - 1].cost;
          else this.serverList[i].bestcost = this.rc.PathCost(bestpath);
		  
		  //use this first run calculation for the purpose of some initial card checks
          var endPoint =
            this.serverList[i].bestpath[this.serverList[i].bestpath.length - 1];
          var runCreditCost = endPoint.runner_credits_spent + endPoint.runner_credits_lost;
          var runClickCost = endPoint.runner_clicks_spent;
		  
		  //some cards have code to modify potential (if there will be a click left after the run)
		  if (runClickCost < runner.clickTracker - 1) {
			for (var j=0; j<runner.grip.length; j++) {
				if (typeof runner.grip[j].AIGripRunPotential == 'function') {
					this.serverList[i].potential += runner.grip[j].AIGripRunPotential.call(runner.grip[j], server);
				}
			}
		  }
        }
      }

      //check for inaccessible high-potential servers that might become accessible with some prep
      for (var i = 0; i < this.serverList.length; i++) {
        //add a bit of jitter to make the runner less predictable
        this.serverList[i].potential += 0.2 * Math.random() - 0.1;

        //now check (the 2 is arbitrary but basically 'high potential')
        if (
          this.serverList[i].potential > 2 &&
          this.serverList[i].bestcost == Infinity
        ) {
          var server = this.serverList[i].server;
          //recalculate paths
          var bestpath = this._commonRunCalculationChecks(server,this.serverList[i].useRunEvent,true); //the true is for foresight, i.e. prep first
          if (bestpath) {
            this.serverList = []; //don't run this click
            this._log("Gotta do some prep");
            break;
          }
          //maybe a compatible breaker would help
          if (runner.clickTracker > 1) {
            for (var j = 0; j < server.ice.length; j++) {
              var iceCard = server.ice[j];
              if (PlayerCanLook(runner, iceCard)) {
                if (!this._matchingBreakerInstalled(iceCard)) {
                  for (var k = 0; k < this.cardsWorthKeeping.length; k++) {
					var isSpecialBreaker = false;
					if (this.cardsWorthKeeping[k].AISpecialBreaker) isSpecialBreaker=true;
                    if (
                      ( CheckSubType(this.cardsWorthKeeping[k], "Icebreaker") || isSpecialBreaker ) &&
                      optionList.includes("install")
                    ) {
                      if (
                        BreakerMatchesIce(this.cardsWorthKeeping[k], iceCard) || isSpecialBreaker
                      ) {
						var choices = ChoicesCardInstall(this.cardsWorthKeeping[k]);
                        if (
                          choices.length >
                          0
                        ) {
						  var preferredInstallChoice = 0;
						  if (typeof this.cardsWorthKeeping[k].AIPreferredInstallChoice == 'function') preferredInstallChoice = this.cardsWorthKeeping[k].AIPreferredInstallChoice(choices);
						  if (preferredInstallChoice > -1) {
							  return this._returnPreference(optionList, "install", {
								cardToInstall: this.cardsWorthKeeping[k],
								hostToInstallTo: choices[preferredInstallChoice].host,
							  });
						  }
						}
                      }
                    } else if (
                      this.cardsWorthKeeping[k].title == "Mutual Favor" &&
                      optionList.includes("play")
                    ) {
                      if (FullCheckPlay(this.cardsWorthKeeping[k])) {
                        return this._returnPreference(optionList, "play", {
                          cardToPlay: this.cardsWorthKeeping[k],
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }

      //use the server run-estimate information to sort _cardsInHandWorthKeeping
      this.SortCardsInHandWorthKeeping();

      //don't run servers that have too low potential or infinity cost
      for (var i = this.serverList.length - 1; i > -1; i--) {
        if (
          this.serverList[i].potential < 0.5 ||
          this.serverList[i].bestcost == Infinity
        )
          this.serverList.splice(i, 1); //the 0.5 minimum is arbitrary
      }

      //sort for best potential to cost ratio
      this.serverList.sort(function (a, b) {
        //new sort (values potential more)
        if (b.potential > a.potential) return 1; //b is better
        //ignoring cost for now - otherwise too easy to bait runner into pointless runs
        //else if (b.bestcost < a.bestcost) return 1; //b is better
        /* old sort
			if (a.potential/a.bestcost < b.potential/b.bestcost) return 1; //b is better
			else if ((a.bestcost == b.bestcost)&&(a.potential < b.potential)) return 1; //b is better
			*/
        return -1; //assume a is better
      });
      //console.log(this.serverList);

      //if the best server has lowish potential, it might be better to do other things
      if (this.serverList.length > 0) {
        if (this.serverList[0].potential < 0.75) {
          //this is arbitrary
          //such as installing something
          if (optionList.includes("install")) {
            //hand full? install a memory diamond
            if (
              runner.clickTracker < 2 &&
              runner.grip.length > MaxHandSize(runner)
            ) {
              cardToInstall = this._copyOfCardExistsIn(
                "T400 Memory Diamond",
                runner.grip
              );
              if (cardToInstall) {
                if (ChoicesCardInstall(cardToInstall).length > 0)
                  return this._returnPreference(optionList, "install", {
                    cardToInstall: cardToInstall,
                    hostToInstallTo: null,
                  });
              }
            }
          }
		} else if (
		  priorityEcon &&
		  this.serverList[0].potential < 1.5 &&
		  runner.clickTracker > 1
		) {
          //the values are arbitrary but basically potential is low and might ruin economy 
          this._log("Favouring econ");
          this.serverList = [];
        } else if (
          this.serverList[0].potential < 1.1 &&
          this.serverList[0].bestcost > 1.0 &&
          this.cardsWorthKeeping.length > 0
        ) {
          //the values are arbitrary but basically potential is low and cost is not negligible
          this._log("Favouring setup");
          this.serverList = [];
        }
      }

      if (this.serverList.length > 0) {
        this._log(
          "Best server to run is " +
            this.serverList[0].server.serverName +
            " with " +
            this.serverList[0].potential.toFixed(1) +
            " potential and " +
            this.serverList[0].bestcost.toFixed(1) +
            " cost"
        );
        this.rc.Print(this.serverList[0].bestpath, this.serverList[0].server);
		//use this server for cached path
	    this.cachedBestPath = this.serverList[0].bestpath;
		this.cachedComplete = true;
		this.cachedPathServer = this.serverList[0].server;

        var endPoint =
          this.serverList[0].bestpath[this.serverList[0].bestpath.length - 1];
        var runCreditCost = endPoint.runner_credits_spent + endPoint.runner_credits_lost;
        var runClickCost = endPoint.runner_clicks_spent;

        //maybe install or play something first? (as long as can still complete the run after using the click)
		//we are ignoring the lost card (i.e. lower max damage) for now
        if (runClickCost < runner.clickTracker - 1) {
			var brHighestPriority = 0;
			if (optionList.includes("install")) {
			  cardToInstall = null;
			  //loop through cards in hand and check installables that have AIInstallBeforeRun defined and high enough priority returned
			  //AIInstallBeforeRun returns 0 for "don't", > 0 for "do" with higher return value meaning higher priority
			  for (var i=0; i<runner.grip.length; i++) {
				var ibrCard = runner.grip[i];
				if (typeof ibrCard.AIInstallBeforeRun == "function") {
				  if (CheckInstall(ibrCard)) {
					var ibrPriority = ibrCard.AIInstallBeforeRun.call(ibrCard,this.serverList[0].server,this.serverList[0].potential,runCreditCost,runClickCost);
					if (ibrPriority > brHighestPriority) {
					  if (!this._wastefulToInstall(ibrCard)) {
						  if (runCreditCost < AvailableCredits(runner) - InstallCost(ibrCard)) {
							  var ibrChoices = ChoicesCardInstall(ibrCard);
							  if (ibrChoices.length > 0) {
								  var ibrIsValidInstall = false;
								  if (typeof ibrCard.AIPreferredInstallChoice == "undefined") ibrIsValidInstall = true;
								  else if (ibrCard.AIPreferredInstallChoice.call(ibrCard,ibrChoices) > -1) ibrIsValidInstall = true;
								  if (ibrIsValidInstall) {
									cardToInstall = ibrCard;
									brHighestPriority = ibrPriority;
								  }
							  }
							  
						  }
					  }
					}
				  }
				}
			  }
			  //card found to install before run (and all checks passed above), install it
			  if (cardToInstall) {
				this._log("I should install "+cardToInstall.title+" before running");
				return this._returnPreference(optionList, "install", {
				  cardToInstall: cardToInstall,
				  hostToInstallTo: null,
				}); //assumes unhosted cards for now
			  }
			}
			if (optionList.includes("play")) {
			  cardToPlay = null;
			  var pbrBestChoices = [];
			  //loop through cards in hand and check playables that have AIPlayBeforeRun defined and high enough priority returned
			  //AIPlayBeforeRun returns 0 for "don't", > 0 for "do" with higher return value meaning higher priority
			  for (var i=0; i<runner.grip.length; i++) {
				var pbrCard = runner.grip[i];
				if (typeof pbrCard.AIPlayBeforeRun == "function") {
				  var pbrChoices = FullCheckPlay(pbrCard); //returns list of choices or null
                  if (pbrChoices) {
					var pbrPriority = pbrCard.AIPlayBeforeRun.call(pbrCard,this.serverList[0].server,this.serverList[0].potential,runCreditCost,runClickCost);
					if (pbrPriority > brHighestPriority) {
					  //_wastefulToPlay also checks AIPreferredPlayChoice, if any
					  if (!this._wastefulToPlay(pbrCard, pbrChoices)) {
						  //should probably use PlayCost here but it isn't implemented yet
						  if (runCreditCost < AvailableCredits(runner) - pbrCard.playCost) {
							cardToPlay = pbrCard;
							brHighestPriority = pbrPriority;
							pbrBestChoices = pbrChoices;
						  }
					  }
					}
				  }
				}
			  }
			  //card found to play before run (and all checks passed above), play it
			  if (cardToPlay) {
				this._log("I should play "+cardToPlay.title+" before running");
				var pbrnextprefs = null;
				if (typeof cardToPlay.AIPreferredPlayChoice == 'function') {
					var pbrPrefIndex = cardToPlay.AIPreferredPlayChoice.call(cardToPlay, pbrBestChoices);
					if (pbrPrefIndex > -1) {
						pbrnextprefs = { title:"Playing "+cardToPlay.title, index: pbrPrefIndex };
					}
				}
                return this._returnPreference(optionList, "play", {
                    cardToPlay: cardToPlay,
					nextPrefs: pbrnextprefs
                });
			  }
			}
		}

        //maybe run by playing a run event?
        if (optionList.includes("play")) {
          //playing a card would reduce the max damage, make sure it is still safe
          var pathdamage = this.rc.TotalDamage(
            this.rc.TotalEffect(
              this.serverList[0].bestpath[
                this.serverList[0].bestpath.length - 1
              ]
            )
          );
          if (pathdamage < runner.grip.length + 1) {
			//path is still safe
			if (this.serverList[0].useRunEvent) {
			  //if the suggested run event provides extra credits, decompensate to see if it's necessary by checking the path cost spent (not lost) credits, no recalculation
			  if (this.serverList[0].useRunEvent.AIRunEventExtraCredits) {
				if (
				  AvailableCredits(runner) >=
				  this.serverList[0].bestpath[
					this.serverList[0].bestpath.length - 1
				  ].runner_credits_spent
				) {
				  //i.e the run could be made without using the extra credits so we should save it for later
				  this.serverList[0].useRunEvent = null;
				}
			  }
			  //still committing to using this run event?
			  if (this.serverList[0].useRunEvent) {
				  return this._returnPreference(optionList, "play", {
					cardToPlay: this.serverList[0].useRunEvent,
					nextPrefs: { chooseServer: this.serverList[0].server },
				  });
			  }
			}			
          }
        }

        //maybe run by triggering a run ability
        if (useConduit && this.serverList[0].server == corp.RnD)
          return this._returnPreference(optionList, "trigger", {
            cardToTrigger: useConduit,
            nextPrefs: { chooseServer: this.serverList[0].server },
          });
        if (useRedTeam) {
          var redTeamServer = null;
          if (!useRedTeam.runHQ && this.serverList[0].server == corp.HQ)
            redTeamServer = corp.HQ;
          else if (!useRedTeam.runRnD && this.serverList[0].server == corp.RnD)
            redTeamServer = corp.RnD;
          else if (
            !useRedTeam.runArchives &&
            this.serverList[0].server == corp.archives
          )
            redTeamServer = corp.archives;
          if (redTeamServer)
            return this._returnPreference(optionList, "trigger", {
              cardToTrigger: useRedTeam,
              nextPrefs: { chooseServer: redTeamServer },
            });
        }

		var serverToRun = this.serverList[0].server;
		this.serverList = []; //clear the list (no server is best to run mid-run)
        return this._returnPreference(optionList, "run", {
          serverToRun: serverToRun,
        });
      }
    }

	//if not running...
	this._log("Don't want to run right now");

	//is there priority economy to consider?
	if (!priorityEcon) {
		//maybe need to draw?
		var maxOverDraw = this._maxOverDraw();
		var currentOverDraw = this._currentOverDraw();
		if (currentOverDraw < maxOverDraw) {
		  //a card that could be installed?
		  if (optionList.includes("install")) {
			for (var i = 0; i < this.drawInstall.length; i++) {
			  //if this.drawInstall[i] is found in hand, and can be installed, install it
			  cardToInstall = this._copyOfCardExistsIn(
				this.drawInstall[i],
				runner.grip
			  );
			  if (cardToInstall) {
				if (!this._wastefulToInstall(cardToInstall)) {
				  this._log("I'd like to install "+cardToInstall.title);
				  var canBeInstalled = true;
				  if (!CheckInstall(cardToInstall)) canBeInstalled = false;
				  //this doesn't check costs
				  else if (ChoicesCardInstall(cardToInstall).length < 1)
					canBeInstalled = false; //this checks credits, mu, available hosts, etc.
				  if (canBeInstalled) {
					this._log("and I could install it");
					return this._returnPreference(optionList, "install", {
					  cardToInstall: cardToInstall,
					  hostToInstallTo: null,
					}); //assumes unhosted cards for now
				  }
				}
			  }
			}
		  }

		  //or maybe an event card?
		  if (optionList.includes("play")) {
			//find highest priority draw card
			var cardToPlay=null;
			var cardPriority=0;
			for (var i = 0; i < runner.grip.length; i++) {
				if (runner.grip[i].AIPlayToDraw) {
				  if (runner.grip[i].AIPlayToDraw > cardPriority) {
					if (FullCheckPlay(runner.grip[i])) {
					  var playThis = true; //if no specific rules have been defined then just play it whenever you can
					  if (typeof(runner.grip[i].AIWouldPlay) == 'function') playThis = runner.grip[i].AIWouldPlay.call(runner.grip[i]);
					  if (playThis) {					
						cardToPlay=runner.grip[i];
						cardPriority=runner.grip[i].AIPlayToDraw;
					  }
					}
				  }
				}
			}
			if (cardToPlay) {
			  this._log("there is an event card I would play to draw");
			  return this._returnPreference(optionList, "play", {
				cardToPlay: cardToPlay,
			  });
			}
		  }

		  //just an ordinary draw action, then
		  if (optionList.includes("draw")) return optionList.indexOf("draw");
		}
		else if (currentOverDraw > maxOverDraw) {
			this._log("Maybe the excess grip situation could be improved");
			//maybe install something that could increase maximum hand size?
			if (optionList.includes("install")) {
				for (var i = 0; i < this.maxHandIncreasers.length; i++) {
				  //if this.maxHandIncreasers[i] is found in hand, and can be installed, install it
				  cardToInstall = this._copyOfCardExistsIn(
					this.maxHandIncreasers[i],
					runner.grip
				  );
				  if (this._commonCardToInstallChecks(cardToInstall)) {
					  this._log("there's one I could install");
					  return this._returnPreference(optionList, "install", {
						cardToInstall: cardToInstall,
						hostToInstallTo: null,
					  }); //assumes unhosted cards for now
				  }
				}
			}
		}
	}

    //nothing else worth doing? consider making money
    var prioritiseEconomy = true;
    //economy check is pretty simple at the moment (and arbitrary)
    if (runner.creditPool > 12) {
      //&&(runner.creditPool > corp.creditPool))
      this._log("Don't need more credits right now");
      prioritiseEconomy = false;
    }
    if (prioritiseEconomy) {
      this._log("More credits could be nice");
      //something to play?
      if (optionList.includes("play")) {
        for (var i = 0; i < this.economyPlay.length; i++) {
          //if this.economyPlay[i] is found in hand, and can be played, play it
          cardToPlay = this._copyOfCardExistsIn(
            this.economyPlay[i],
            runner.grip
          );
          if (cardToPlay) {
            this._log("maybe by playing a card?");
			var ctpChoices = FullCheckPlay(cardToPlay); //returns list of choices or null
            if (
              ctpChoices &&
              !this._wastefulToPlay(cardToPlay, ctpChoices)
            ) {
			  var playThis = true; //if no specific rules have been defined then just play it whenever you can
			  if (typeof(cardToPlay.AIWouldPlay) == 'function') playThis = cardToPlay.AIWouldPlay.call(cardToPlay);
			  if (playThis) {
				  this._log("there's one I would play");
				  return this._returnPreference(optionList, "play", {
					cardToPlay: cardToPlay,
				  });
			  }
            }
          }
        }
      }
	  
      //or trigger?
      if (optionList.includes("trigger")) {
		//find highest priority econ trigger card
        var activeCards = ActiveCards(runner);
        var limitTo = "";
        if (currentPhase.identifier == "Runner 1.3") limitTo = "click";
        cardToTrigger=null;
		var cardPriority=0;
        for (var i = 0; i < activeCards.length; i++) {
		    if (activeCards[i].AIEconomyTrigger) {
			  if (activeCards[i].AIEconomyTrigger > cardPriority) {
				if (ChoicesAbility(activeCards[i], limitTo).length > 0) {
				  //i.e. it can be triggered
				  var triggerThis = true; //if no specific rules have been defined then just trigger it whenever you can
				  if (typeof(activeCards[i].AIWouldTrigger) == 'function') triggerThis = activeCards[i].AIWouldTrigger.call(activeCards[i]);
				  if (triggerThis) {					
					cardToTrigger=activeCards[i];
					cardPriority=activeCards[i].AIEconomyTrigger;
				  }
				}
			  }
		    }
		}
        if (cardToTrigger) {
          this._log("there is a card I would trigger for economy");
		  return this._returnPreference(optionList, "trigger", {
			cardToTrigger: cardToTrigger,
          }); //assumes no parameters for now
        }
      }
	  
      //or maybe install?
      if (optionList.includes("install")) {
		//find highest priority econ install card
        cardToInstall=null;
		var cardPriority=0;
        for (var i = 0; i < runner.grip.length; i++) {
		    if (runner.grip[i].AIEconomyInstall) {
			  if (runner.grip[i].AIEconomyInstall > cardPriority) {
				if (this._commonCardToInstallChecks(runner.grip[i])) {
				  var installThis = true; //if no specific rules have been defined then just install it whenever you can
				  if (typeof(runner.grip[i].AIWouldInstall) == 'function') installThis = runner.grip[i].AIWouldInstall.call(runner.grip[i]);
				  if (installThis) {					
					cardToInstall=runner.grip[i];
					cardPriority=runner.grip[i].AIEconomyInstall;
				  }
				}
			  }
		    }
		}
        if (cardToInstall) {
          this._log("there is a card I would install for economy");
		  return this._returnPreference(optionList, "install", {
			cardToInstall: cardToInstall,
            hostToInstallTo: null,
          }); //assumes unhosted cards for now
        }
      }
	}
    //other cards that may or may not be economy but were considered to be worthwhile
	this._log("Ok not economy, something else?");
    for (var i = 0; i < this.cardsWorthKeeping.length; i++) {
      var card = this.cardsWorthKeeping[i];
      if (card.cardType == "event" && optionList.includes("play")) {
        //play
		var cwkpChoices = FullCheckPlay(card); //returns list of choices or null
        if (cwkpChoices && !this._wastefulToPlay(card,cwkpChoices)) {
          this._log("there's a card worth playing");
          return this._returnPreference(optionList, "play", {
            cardToPlay: card,
          });
        }
      } else if (optionList.includes("install")) {
        //install
        var canBeInstalled = true;
		var installDestination = null; //directly to rig (no host)
        var choices = ChoicesCardInstall(card);
        if (!CheckInstall(card)) canBeInstalled = false;
        //this doesn't check costs
        else if (choices.length < 1) canBeInstalled = false;
        //this checks credits, mu, available hosts, etc.
        else if (typeof card.AIPreferredInstallChoice == "function") {
		  var apicIndex = card.AIPreferredInstallChoice(choices);
          if (apicIndex < 0)
            canBeInstalled = false; //card AI code deemed it unworthy
		  else installDestination = choices[apicIndex].host;
        }
        if (canBeInstalled && !this._wastefulToInstall(card)) {
          this._log("there's one I could install");
          return this._returnPreference(optionList, "install", {
            cardToInstall: card,
            hostToInstallTo: installDestination,
          });
        }
      }
    }

    //more reasons to install and play (defined per card, BUT don't install low priority stuff if there are cards-worth-keeping which we can't afford yet)
    if (this.cardsWorthKeeping.length < 1) {
      for (var i = 0; i < runner.grip.length; i++) {
        var card = runner.grip[i];
        if (card.cardType !== "event") {
		  //non-event (i.e. install)
          if (
            optionList.includes("install") &&
            !this._wastefulToInstall(card)
          ) {
            var choices = ChoicesCardInstall(card);
            if (choices.length > 0) {
              var preferredInstallChoice = 0; //if no specific rules have been defined then just install it whenever you can
              //AIPreferredInstallChoice(choices) outputs the preferred index from the provided choices list (return -1 to not install)
              if (typeof card.AIPreferredInstallChoice == "function")
                preferredInstallChoice = card.AIPreferredInstallChoice(choices);
              if (preferredInstallChoice > -1 && CheckInstall(card)) {
                this._log("maybe install this...");
                return this._returnPreference(optionList, "install", {
                  cardToInstall: card,
                  hostToInstallTo: choices[preferredInstallChoice].host,
                });
              }
            }
          }
        } 
        else {
            //event (i.e. play)
			if (optionList.includes("play"))
			{
				//don't just play things randomly, only if there is a specifically defined reason
				if (typeof(card.AIWouldPlay) == 'function') {
					var playThis = card.AIWouldPlay.call(card);
					var playChoices = FullCheckPlay(card); //returns list of choices or null
					if (playThis&&playChoices&&(!this._wastefulToPlay(card,playChoices)))
					{
						this._log("maybe play "+card.title);
						var playNextPrefs = null;
						if (typeof card.AIPreferredPlayChoice == 'function') {
							var playPrefIndex = card.AIPreferredPlayChoice.call(card, playChoices);
							if (playPrefIndex > -1) {
								playNextPrefs = { title:"Playing "+card.title, index: playPrefIndex };
							}
						}
						return this._returnPreference(optionList, "play", {
							cardToPlay: card,
							nextPrefs: playNextPrefs
						});
					}
				}
			}
        }
      }
    }

    //well, just click for credits I guess
    if (optionList.includes("gain")) {
      //unless we're too rich in which case need more options so draw cards
      if (!prioritiseEconomy && optionList.includes("draw"))
        return optionList.indexOf("draw");
      return optionList.indexOf("gain");
    }

    //*** END DECISIONMAKING LOGIC ***

    //uncertain? choose at random
    this._log(
      "AI (" +
        currentPhase.identifier +
        "): No decision made, choosing at random from:"
    );
    this._log(JSON.stringify(optionList));
    this._log("Current phase identifier: " + currentPhase.identifier);
    this._log("Current phase title: " + currentPhase.title);
    this._log("Executing command: " + executingCommand);
    return RandomRange(0, optionList.length - 1);
  }

  _computeChoice(optionList, choiceType) {
	var ret = this._internalChoiceDetermination(optionList, choiceType);
	
	//restore temporary set values
	this._RestoreTemporaryValueModifications();
	
	return ret;
  }

  CommandChoice(inputOptionList) {
	//make a local copy so we can add pretend options if we want
	//note the elements are not new copies, just the container
	var optionList = [];
	for (var i=0; i<inputOptionList.length; i++) {
		optionList.push(inputOptionList[i]);
	}

	var ret = this._computeChoice(optionList, "command");

	//some return values we may want to replace

	//cards that could be played to install (e.g. with discount)
	if (ret == optionList.indexOf("install") && this.preferred && typeof this.preferred.cardToInstall != 'undefined') {
		//use install pref after play preference resolves
		var nextPrefs = {
			cardToInstall: this.preferred.cardToInstall,
			hostToInstallTo: null,
			command: "continue",
			useAsCommand: "install",
		};
		if (typeof this.preferred.hostToInstallTo != 'undefined') nextPrefs.hostToInstallTo = this.preferred.hostToInstallTo;
		//but only if a valid card play exists
		for (var i=0; i<runner.grip.length; i++) {
			var cardToPlay = runner.grip[i];
			if (typeof cardToPlay.AIPlayForInstall == 'function') {
                  if (FullCheckPlay(cardToPlay)) {
                    if (cardToPlay.AIPlayForInstall.call(cardToPlay, this.preferred.cardToInstall)) {
						ret = this._returnPreference(inputOptionList, "play", {
						  cardToPlay: cardToPlay,
						  nextPrefs: nextPrefs,
						});	
						break; //this means we might not be using the best card for the job but prevents crazy incorrect stacking
					}
                  }
			}
		}
	}
	
	//if option is not in list, choose 0 and give error
	if (ret < 0 || ret > inputOptionList.length - 1) {
		console.log(inputOptionList);
		console.error("Error in CommandChoice: choice "+ret+" returned for inputOptionList above");
		ret = 0;
	}
		
    return ret;
  }

  SelectChoice(optionList) {
    return this._computeChoice(optionList, "select");
  }

  GameEnded(winner) {}
}
