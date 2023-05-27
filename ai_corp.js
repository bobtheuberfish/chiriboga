//AI decisionmaking

class CorpAI {
  //**CORP UTILITY FUNCTIONS**
  _log(message) {
    //just comment this line to suppress AI log
    console.log("AI: " + message);
  }

  _iceIsDisabled(iceCard) {
	//for now assume hosted cards disable it
	if (typeof iceCard.hostedCards !== "undefined") {
	  if (iceCard.hostedCards.length > 0) return true;
	}
	//or if chosen by Femme
	var femmes = this._copiesOfCardIn("Femme Fatale", runner.rig.programs);
	for (var i=0; i<femmes.length; i++) {
		if (femmes[i].chosenCard == iceCard) return true;
	}
	//not disabled
	return false;
  }

  //this returns either a list of affordable ice or a list or not-affordable ice
  //'affordable' isn't necessarily monetary e.g. it may not be tactically 'affordable' right now
  _iceInCardsCommon(
    serverToInstallTo,
    affordable,
    cards //utility used by affordable/not ice listers (affordable is a boolean)
  ) {
    if (typeof cards == "undefined") cards = corp.HQ.cards; //usually installing from hand but this makes other options possible
    var extraCost = 0;
    if (serverToInstallTo != null) {
		//take into account install cost if not first ice in server
		extraCost += serverToInstallTo.ice.length;
		//and unrezzed ice already in the server
		var uri = this._unrezzedIce(serverToInstallTo);
		for (var i=0; i<uri.length; i++) {
			extraCost += RezCost(uri[i]);
		}
	}
    var relevantIceInCards = [];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].cardType == "ice") {
		if (extraCost < corp.creditPool) { //even not-affordable ice is excluded if it can't be installed
			var yesToThisIce = true;
			if (typeof cards[i].AIWorthwhileIce == 'function') {
			  yesToThisIce = cards[i].AIWorthwhileIce.call(cards[i],serverToInstallTo,"install");
			}
			var isAffordable = (cards[i].rezCost + extraCost <= corp.creditPool) && yesToThisIce;
			if (affordable == isAffordable) relevantIceInCards.push(cards[i]);
		}
      }
    }
    return relevantIceInCards;
  }

  _affordableIce(
    serverToInstallTo,
    cards //returns all ice in cards (or hand, if cards not specified) with cost equal to or less than credit pool
  ) {
    if (typeof cards == "undefined") cards = corp.HQ.cards; //usually installing from hand but this makes other options possible
    return this._iceInCardsCommon(serverToInstallTo, true, cards);
  }

  _notAffordableIce(
    serverToInstallTo,
    cards //returns all ice in hand with cost greater than credit pool
  ) {
    if (typeof cards == "undefined") cards = corp.HQ.cards; //usually installing from hand but this makes other options possible
    return this._iceInCardsCommon(serverToInstallTo, false, cards);
  }

  //array of unrezzed ice in server
  _unrezzedIce(server) {
    var ret = [];
    if (server == null) return ret;
    for (var i = 0; i < server.ice.length; i++) {
      if (!server.ice[i].rezzed) ret.push(server.ice[i]);
    }
    return ret;
  }

  //array of rezzed ice in server
  _rezzedIce(server) {
    var ret = [];
    if (server == null) return ret;
    for (var i = 0; i < server.ice.length; i++) {
      if (server.ice[i].rezzed) ret.push(server.ice[i]);
    }
    return ret;
  }

  _copyAlreadyInstalled(
    card //returns true if a copy already installed (rezzed or unrezzed)
  ) {
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

  _uniqueCopyAlreadyInstalled(
    card //returns true if is unique and a copy already installed (rezzed or unrezzed)
  ) {
    if (!card.unique) return false; //i.e. .unique == false or undefined
    return this._copyAlreadyInstalled(card);
  }

  _iceInstallScore(ice, serverToInstallTo) {
	//higher is better
	var ret = 0;
	//put a temporary copy of this card into the server to test for effects (if it's null we'll need a pretend remote)
	if (serverToInstallTo == null) corp.remoteServers.push({ice:[ice], root:[]});
	else serverToInstallTo.ice.push(ice);
	//start with strength as a base
	ret = Strength(ice);
	//include rez cost as an assumption of value
	ret += RezCost(ice);
	//special specifics
	if (ice.title == "Palisade" && serverToInstallTo != null && typeof(serverToInstallTo.cards) !== 'undefined') ret -= 3; //arbitrary, encourage to save Palisade for remotes
    //weaker if threatened
    if (this._aCompatibleBreakerIsInstalled(ice)) ret *= 0.5;
    //remove the temporary copy
	if (serverToInstallTo == null) corp.remoteServers.splice(corp.remoteServers.length-1,1); //by removing the pretend server
	else serverToInstallTo.ice.splice(serverToInstallTo.ice.length-1,1); //by removing the temporary ice copy
    return ret;
  }

  //returns the ice (assumes list is all ice and at least one present)
  _bestIceToInstall(iceToChooseFrom, serverToInstallTo) {
	if (iceToChooseFrom.length < 2) return iceToChooseFrom[0];
	//calculate an install score for each (higher is better)
	for (var i=0; i<iceToChooseFrom.length; i++) {
		iceToChooseFrom[i].AIIceInstallScore = this._iceInstallScore(iceToChooseFrom[i], serverToInstallTo);
	}
	//now sort
	iceToChooseFrom.sort(function(a,b) {
	  return b.AIIceInstallScore - a.AIIceInstallScore;
	});
	//console.log(iceToChooseFrom);
    return iceToChooseFrom[0]; //just random for now
  }

  //special case e.g Sneakdoor Beta
  _archivesIsBackdoorToHQ() {
	  if (this._copyOfCardExistsIn("Sneakdoor Beta",runner.rig.programs)) {
		  return true;
	  }
	  return false;
  }

  //special case e.g Sneakdoor Beta
  //returns a protection value to be subtracted
  _extraThreatOnRnD() {
	  var conduit = this._copyOfCardExistsIn("Conduit",runner.rig.programs);
	  if (conduit) {
		  //the numbers are arbitrary but basically a bit for each counter and some for existing at all
		  //multiplier was 0.5 and constant was 2.5. AI still seemed to underappreciate it so I increased these.
		  return 1.0 * Counters(conduit,"virus") + 3.0;
	  }
	  return 0;
  }

  //returns the preferred server. input is the upgrade to install
  _bestServerToUpgrade(upgrade) {
    var preferredServer = null; //install into new if necessary
    var nonEmptyProtectedRemotes = this._nonEmptyProtectedRemotes();
    if (nonEmptyProtectedRemotes.length > 0)
      preferredServer = nonEmptyProtectedRemotes[0];
    if (!preferredServer || this._protectionScore(corp.RnD, {}) < this._protectionScore(preferredServer, {})) {
		if (this._protectionScore(corp.HQ, {returnArchivesLowerScoreForHQIfBackdoor:true}) < this._protectionScore(corp.RnD, {})) {
		  if (this._archivesIsBackdoorToHQ() && this._protectionScore(corp.archives, {}) < this._protectionScore(corp.HQ, {})) preferredServer = corp.archives;
		  else preferredServer = corp.HQ;
		}
		else preferredServer = corp.RnD;
	}
    return preferredServer;
  }

  _isAScoringServer(
    server //note that this can includes servers with and without non-upgrade cards installed (so be careful what you would need to trash to install)
  ) {
    if (server == null) return false; //protection is too weak
    if (typeof server.cards == "undefined") {
      //is remote
      //yes if it has a scoring upgrade, an agenda or an ambush installed
	  //this code was originally after the protection check but this lead to AI installing random assets in scoring servers
      for (var j = 0; j < server.root.length; j++) {
        if (server.root[j].AIIsScoringUpgrade) return true;
        if (CheckCardType(server.root[j], ["agenda"])) return true;
        if (CheckSubType(server.root[j], "Ambush")) return true;
      }

      //no if its protection is too weak
      var protScore = this._protectionScore(server, {});
      var minProt = this._protectionScore(corp.HQ, {returnArchivesLowerScoreForHQIfBackdoor:true}); //new method: just needs to be at least as strong as HQ
	  //var minProt = RandomRange(3, 4); //arbitrary: tweak as needed (old method)
	  if (this._agendasInHand() > MaxHandSize(corp) - 1) {
		//if it's going to be thrown out, it just has to be better protection than Archives
        minProt = this._protectionScore(corp.archives, {ignoreBackdoorFromArchives:true}); 
	  }
      if (protScore < minProt) return false;

      //no if there is a better server available (empty except for a scoring upgrade, or stronger protection score)
      var emptyProtectedRemotes = this._emptyProtectedRemotes();
      for (var i = 0; i < emptyProtectedRemotes.length; i++) {
        if (server !== emptyProtectedRemotes[i]) {
          for (var j = 0; j < emptyProtectedRemotes[i].root.length; j++) {
            if (emptyProtectedRemotes[i].root[j].AIIsScoringUpgrade)
              return false;
          }
        }
      }
      //otherwise yes if it is the empty remote server with the most protection
      if (emptyProtectedRemotes.length > 0) {
        if (server == emptyProtectedRemotes[0]) return true;
      }
    }
    return false;
  }

  //returns all scoring servers (in order from strongest to weakest, if input is in that order
  _scoringServers(emptyProtectedRemotes) {
	var ret = [];
	//loop through possible scoring servers
	for (var j = 0; j < emptyProtectedRemotes.length; j++) {
		var emptyProtectedRemote = emptyProtectedRemotes[j];
		if (this._isAScoringServer(emptyProtectedRemote))
		  ret.push(emptyProtectedRemote);
	}
    return ret;
  }

  //returns value of current scoring window if using the given server (zero if no window)
  _scoringWindow(server) {
	var ret = 0;
	ret = this._protectionScore(server, {}) - this._protectionScore(corp.HQ, {returnArchivesLowerScoreForHQIfBackdoor:true}) + (0.3*this._clicksLeft()) + (Credits(corp)/(Credits(runner)+1.0)) - 1.0;
	return ret;
  }

  //if inhibit is false, more willing installs are permitted (use this for free install&rez)
  _shouldUpgradeServerWithCard(server, card, inhibit=true) {
    if (CheckCardType(card, ["upgrade"])) {
	  //although we could install more than one copy of a unique card, let's not
	  if (this._uniqueCopyAlreadyInstalled(card)) return false;
	  if (server) {
		  //limit 1 region per server
		  if (CheckSubType(card, "Region")) {
			for (var i=0; i<server.root.length; i++) {
			  if (CheckSubType(server.root[i], "Region")) return false;
			};
		  }
		  //or some other limit, if defined
		  if (typeof card.AILimitPerServer == 'function') {
			var numberThatWouldBeInServer = 1; //for this one we're installing
			server.root.forEach(function(item) {
			  if (item.title == card.title) numberThatWouldBeInServer++;
			});
			if (numberThatWouldBeInServer > card.AILimitPerServer.call(card,server)) return false;
		  }
	  }
	  if (!inhibit) return true;
	  if (card.AIIsScoringUpgrade) {
        if (!this._isAScoringServer(server)) return false;
      }
	  if (typeof card.AIDefensiveValue == 'function') {
		if (card.AIDefensiveValue.call(card, server) < 1) return false;
	  }
      return true; //should be ok to install
    }
    return false;
  }

  _upgradeInstallPreferences(
    server,
    cards, //if server is not specified, the best server for each card will be chosen
	inhibit=true //if inhibit is false, more willing installs are permitted (use this for free install&rez)
  ) {
    var ret = [];
    if (typeof cards == "undefined") cards = corp.HQ.cards; //usually installing from hand but this makes other options possible
    for (var i = 0; i < cards.length; i++) {
      var serverToInstallTo = this._bestServerToUpgrade(cards[i]);
      if (typeof server !== "undefined") serverToInstallTo = server;
      if (this._shouldUpgradeServerWithCard(serverToInstallTo, cards[i], inhibit))
        ret.push({
          cardToInstall: cards[i],
          serverToInstallTo: serverToInstallTo,
        });
    }
    return ret;
  }

  //this modifies the input array
  _reducedDiscardList(
    optionList,
    minCount = 1, //reduces optionList (only include ones we are ok to discard) but keeps list size at or above minCount
	maxCount //and at or below maxCount
  ) {
	if (typeof maxCount == "undefined") maxCount = minCount;
    //don't discard agendas
    for (
      var i = 0;
      i < optionList.length && optionList.length > minCount;
      i++
    ) {
      if (typeof optionList[i].card !== "undefined") {
        //in case there are non-card options present
        if (CheckCardType(optionList[i].card, ["agenda"])) {
          optionList.splice(i, 1);
          i--;
        }
      }
    }
    //other than that, use common what's-the-best-card-to-keep code to remove cards from discard list
	while (optionList.length > maxCount) optionList.splice(optionList.indexOf(this._bestNonAgendaTutorOption(optionList)), 1); //the 1 means remove 1 card
	//the worst-cards-to-keep are left now, return them
    return optionList;
  }
  
  //this may modify the input array but accept the return value to guarantee modification
  //reduces optionList to the one we want most to return to RnD
  _reduceOptionsToBestCardToReturnToRnD(
    optionList
  ) {
	var logStart = "Best card to return to R&D from "+JSON.stringify(CardsInOptionList(optionList));
	//if HQ is not protected or there is more than one agenda in hand, return agendas to R&D
	var returnAgendasToRnD = false;
	if ( this._agendasInHand() > 1 || this._serverToProtect() == corp.HQ ) returnAgendasToRnD = true;
	if (returnAgendasToRnD) {
		for (var i=0; i<optionList.length; i++) {
			if (optionList[i].card.cardType == 'agenda') optionList = [optionList[i]];
		}
	}
	if (optionList.length > 1) optionList = this._reducedDiscardList(optionList, 1, 1); //values here are min and max number of cards to choose (i.e. exactly 1)
	this._log(logStart+" is "+optionList[0].card.title);
	return optionList;
  }

  _bestDiscardOption(optionList) {
    this._log("considering discard options...");
	//importantly, this modifies the input array to length 1
	//so that the choice of index 0 is the best option (ideally the only one left)
    optionList = this._reducedDiscardList(optionList, 1, 1); //values here are min and max number of cards to choose (i.e. exactly 1)
    return 0; //just arbitrary for now
  }
  
  _bestSabotageOption(optionList) {
	//importantly, this modifies the input array to length 1 (recreates the desired option)
	var minSabotageFromHQ = optionList[optionList.length-1].minSabotageFromHQ;
    this._log("considering sabotage options, need to trash at least "+minSabotageFromHQ+" from HQ");
	var selectCards = optionList[optionList.length-1].cards;
	//make a faux option list for discard helper to use
	var fauxOptionList = ChoicesHandCards(corp);
    fauxOptionList = this._reducedDiscardList(fauxOptionList, minSabotageFromHQ, selectCards.length); //min is minSabotageFromHQ, max is selectCards.length
	//convert back to multi-select
	for (var i=0; i<fauxOptionList.length; i++) {
		selectCards[i]=fauxOptionList[i].card;
	}
	optionList.splice(0, optionList.length - 1); //remove all but the last element
    return 0; //there is only one option
  }

  _bestForfeitOption(optionList) {
	this._log("considering forfeit options...");
	var ret = 0;
	var forfAg = null;
    for (var i=0; i<corp.scoreArea.length; i++) {
		if (!forfAg) {
			ret = i;
			forfAg = corp.scoreArea[i];
		}
		else if (corp.scoreArea[i].agendaPoints < forfAg.agendaPoints) {
			ret = i;
			forfAg = corp.scoreArea[i];
		}
		else if (corp.scoreArea[i].agendaPoints == forfAg.agendaPoints && Counters(corp.scoreArea[i],"agenda") < Counters(forfAg,"agenda")) {
			ret = i;
			forfAg = corp.scoreArea[i];
		}
    }
	return ret;
  }
  
  //get the desired advancement limit (may exceed advancement requirement)
  _advancementLimit(card,server) {
	if (typeof server == 'undefined') server = GetServer(card);
	var ret = Infinity;
    if (typeof card.AIAdvancementLimit == "function") {
        ret = card.AIAdvancementLimit.call(card);
	}
    else if (typeof card.advancementRequirement !== "undefined") {
        ret = AdvancementRequirement(card);
	}
	//rezzed/unrezzed SanSan (except overadvanced, or already applied by AdvancementRequirement)
	if (server && typeof card.advancementRequirement !== "undefined" && ret == card.advancementRequirement) {
		var sanSan = this._copyOfCardExistsIn("SanSan City Grid", server.root);
		if (sanSan) {
			//ignoring other discounts for now
			//this is approximate - for proper calculation would probably need some kind of combined use of _potentialAdvancement
			if (sanSan.rezzed || AvailableCredits(corp) >= RezCost(sanSan) + ret - Counters(card,"advancement")) ret--;
		}
	}
	return ret;
  }

  //amount of advancement that still needs to be added to reach limit
  _advancementStillRequired(card, server) {
	if (typeof server == 'undefined') server = GetServer(card);
	return this._advancementLimit(card) - Counters(card,"advancement");
  }

  _bestAdvanceOption(optionList) {
    //currently just chooses first reasonable option (TODO need to do more work here to include/exclude/rank them)
	//e.g. using _cardShouldBeFastAdvanced and/or _isFullyAdvanceableAgenda or similar
    for (var i = 0; i < optionList.length; i++) {
      if (
        typeof optionList[i].card.advancement === "undefined" ||
        optionList[i].card.advancement < this._advancementLimit(optionList[i].card) ||
        optionList[i].card.AIOverAdvance
      )
        return i;
    }
    return 0; //just arbitrary
  }
  
  _highestELO(cards) {
	if (cards.length < 1) {
		console.error("Empty cards array?");
		return;
	}
	var ret = cards[0];
	var highestElo = cards[0].elo;
	for (var i=1; i<cards.length; i++) {
		if (cards[i].elo > highestElo) {
			highestElo = cards[i].elo;
			ret = cards[i];
		}
	}
	return ret;
  }
  
  //return option of best economy card in source option list
  //or null if no economy option found
  _bestEconomyCardOption(optionList) {
	var economyCards = this._economyCards();
	for (var i=0; i<economyCards.length; i++) {
		for (var j=0; j<optionList.length; j++) {
			if (optionList[j].card) {
				if (economyCards[i] == optionList[j].card.title) return optionList[j];
			}
		}
	}
	return null;
  }

  //returns the option or null if not found
  _firstOptionWithCard(optionList, card) {
	for (var i=0; i<optionList.length; i++) {
		if (optionList[i].card) {
			if (optionList[i].card == card) return optionList[i];
		}
	}
	return null;
  }
  
  //returns null if no agendas found in options
  _bestAgendaTutorOption(optionList) {
	  //just random for now
	  for (var i=0; i<optionList.length; i++) {
		if (optionList[i].card) {
			if (CheckCardType(optionList[i].card, ["agenda"])) return optionList[i]; 
		}
	  }
	  return null;
  }
  
  _bestNonAgendaTutorOption(optionList,onlyTheBest=false) {
	//fast advance
	var fastAdvanceCards = [];
	for (var i=0; i<optionList.length; i++) {
		if (optionList[i].card) {
			if (optionList[i].card.AIFastAdvance) fastAdvanceCards.push(optionList[i].card);
		}
	}
	if (fastAdvanceCards.length > 0) return this._firstOptionWithCard(optionList,this._highestELO(fastAdvanceCards));
	//opportunity (e.g. tag punishment/damage)
	var opportunityCards = [];
	for (var i=0; i<optionList.length; i++) {
		if (optionList[i].card && !optionList[i].card.AIIsRecurOrTutor) {
			if ( optionList[i].card.AITagPunishment || optionList[i].card.AIDamageOperation || ( typeof optionList[i].card.AIWouldPlay == 'function' && optionList[i].card.AIWouldPlay.call(optionList[i].card) ) ) opportunityCards.push(optionList[i].card);
		}
	}
	if (opportunityCards.length > 0) return this._firstOptionWithCard(optionList,this._highestELO(opportunityCards));
	if (onlyTheBest) return null;
	//if economy isn't looking too good, choose an econ card
	if (!this._sufficientEconomy()) {
		var bestEconomyOption = this._bestEconomyCardOption(optionList);
		if (bestEconomyOption) return bestEconomyOption;
	}
	//if no affordable ice in hand, choose ice
	var cardList = [];
	for (var i=0; i<optionList.length; i++) {
		if (optionList[i].card && !optionList[i].card.AIIsRecurOrTutor) cardList.push(optionList[i].card);
	}
	if (!this._affordableIce(null).length == 0) {
	  var affordableIceInList = this._affordableIce(null,cardList);
	  if (affordableIceInList.length > 0) return this._firstOptionWithCard(optionList,this._highestELO(affordableIceInList));
	}
	//choose highest elo card in option list
	cardList = [];
	for (var i=0; i<optionList.length; i++) {
		if (optionList[i].card) cardList.push(optionList[i].card);
	}
	return this._firstOptionWithCard(optionList,this._highestELO(cardList));
  }

  _bestRecurToHQOption(optionList,serverUnderThreat,useNowIfPossible=false) {
	  if (optionList.length < 1) return null;
	  var ret = null;
	  if (typeof serverUnderThreat == 'undefined') serverUnderThreat = null; //no server under threat
	  //if archives is under threat, only recur agendas (rank by highest points)
	  if (serverUnderThreat == corp.archives) {
		var hap = 0;
		for (var i=0; i<optionList.length; i++) {
			if (optionList[i].card) {
				if (optionList[i].card.agendaPoints) {
					if (optionList[i].card.agendaPoints > hap) {
						hap = optionList[i].card.agendaPoints;
						ret = optionList[i];
					}
				}
			}
		}
		return ret;
	  }
	  //if HQ is under threat and contains agendas, seek to pad with non agenda cards
	  if (serverUnderThreat == corp.HQ && this._agendasInHand() > 0) {
		  useNowIfPossible = true;
		  //Snare! to make HQ more dangerous (if have snare credits)
		  if (CheckCredits(corp,4)) {
			  for (var i=0; i<optionList.length; i++) {
				if (optionList[i].card) {
				  if (optionList[i].card.title == "Snare!") return optionList[i];
				}
			  }
		  }
		  //or just any non-agenda card
		  return this._bestNonAgendaTutorOption(optionList);
	  }
	  //TODO don't include multiple copies of cards in archives since only one can be recurred
	  //TODO also take into account whether there will be the credits/clicks after whatever is causing this recur
	  var faai = this._fullyAdvanceableAgendaInstalled(corp.HQ.cards.concat(corp.archives.cards));
	  //look for fast advance cards (if could use to finish an agenda using cards from both HQ and archives)
	  if (useNowIfPossible || faai) {
		  for (var i=0; i<optionList.length; i++) {
			if (optionList[i].card) {
			  if (optionList[i].card.AIFastAdvance) return optionList[i];
			}
		  }
	  }
	  //damage cards (for now, just if useNowIfPossible, later could check here for kill combos)
	  if (useNowIfPossible) {
		  for (var i=0; i<optionList.length; i++) {
			if (optionList[i].card) {
			  if (optionList[i].card.AIDamageOperation) return optionList[i];
			}
		  }
	  }
	  //save the ability for later, if possible
	  if (!useNowIfPossible) return null;
	  //for now it's just arbitrary but could potentially add logic here
	  return optionList[0];
  }

  //this damage is potential because the run could jack out/prevent, not because we don't know the cards
  //this function assumes the runner is mid-run on this server
  _potentialDamageOnBreach(server) {
	if (!server) return 0;
	var ret = 0;
	//1 if it is contains an agenda and identity is Jinteki:PE (unless Runner wins before PE fires)
	if (this._agendaPointsInServer(server) > 0 && corp.identityCard.title=="Jinteki: Personal Evolution") {
		if (!this._runnerMayWinIfServerBreached(server)) ret++;
	}
	//2+advancement if it is an active Urtica
	var urtica = this._copyOfCardExistsIn("Urtica Cipher", server.root);
	if (urtica) ret+=2+urtica.advancement;
	//1 for each scored House of Knives that has at least 1 counter and hasn't been used this run
	for (var i=0; i<corp.scoreArea.length; i++) {
		if (corp.scoreArea[i].title == "House of Knives" && !corp.scoreArea[i].usedThisRun) ret++;
	}
	//3 for Snare! if affordable (for now, assumes exactly one will be accessed)
	var snare = null;
	if (this._copyOfCardExistsIn("Snare!", server.root)) snare = true;
	else if (typeof server.cards != 'undefined') {
		if (this._copyOfCardExistsIn("Snare!", server.cards)) snare = true;
	}
	var creditsLeft = AvailableCredits(corp);
	if (snare && creditsLeft > 3) {
		creditsLeft -= 4;
		ret+=3;
	}
	//1 for Hokusai Grid if affordable (is region so limited to 1)
	if (this._copyOfCardExistsIn("Hokusai Grid", server.root) && creditsLeft > 1) {
		creditsLeft -= 2;
		ret++;
	}
	this._log("Could do "+ret+" damage on breach");
	return ret;
  }

  //NOTE: a copy of this exists in ai_runner so duplicate changes there
  _breachWouldBePrevented(activeCards, server) {
	var ret = false;
	for (var j = 0; j < activeCards.length; j++) {
		if (typeof activeCards[j].AIPreventBreach == 'function') {
		  if (activeCards[j].AIPreventBreach.call(activeCards[j],server)) {
			  return true;
		  }
		}
	}
    return ret;		
  }
  
  _serverContainsUnknownCards(server) {
	if (!server) return false;
	for (var i=0; i<server.root.length; i++) {
		if (!PlayerCanLook(runner,server.root[i])) return true;
	}
	if (typeof server.cards != 'undefined') {
		for (var i=0; i<server.cards.length; i++) {
			if (!PlayerCanLook(runner,server.cards[i])) return true;
		}
	}
	return false;
  }

  _agendaPointsInServer(
    server //returns int
  ) {
	if (!server) return 0;
    var ret = 0;
    for (var i = 0; i < server.root.length; i++) {
      if (CheckCardType(server.root[i], ["agenda"])) ret+=server.root[i].agendaPoints;
    }
    if (typeof server.cards !== "undefined") {
      for (var i = 0; i < server.cards.length; i++) {
        if (CheckCardType(server.cards[i], ["agenda"])) ret+= server.cards[i].agendaPoints;
      }
    }
    return ret;
  }

  //optionally, specific an array of cards to ignore 
  //returns int
  _agendasInServer(
    server,
    ignoreCards=[]
  ) {
	if (!server) return 0;
    var ret = 0;
    for (var i = 0; i < server.root.length; i++) {
      if (CheckCardType(server.root[i], ["agenda"]) && !ignoreCards.includes(server.root[i])) ret++;
    }
    if (typeof server.cards !== "undefined") {
      for (var i = 0; i < server.cards.length; i++) {
        if (CheckCardType(server.cards[i], ["agenda"]) && !ignoreCards.includes(server.cards[i])) ret++;
      }
    }
    return ret;
  }
  
  _agendasInRemoteServers() {
	  var ret = 0;
	  for (var i=0; i<corp.remoteServers.length; i++) {
		  ret += this._agendasInServer(corp.remoteServers[i]);
	  }
	  return ret;
  }
  
  _isHVT(card) { //agendas, ambushes, hostiles. 
    //obselete bluffs are no longer HVTs
	if (this._obsoleteBluff(card)) return false;
	//otherwise...
	return (
		CheckCardType(card, ["agenda"]) ||
		CheckSubType(card, "Ambush") ||
		CheckSubType(card, "Hostile")
	);
  }
  
  _serverValue(server) {
	var ret=0;
	//just simple for now
	for (var i=0; i<server.root.length; i++) {
		if (this._isHVT(server.root[i])) ret++;
	}
	return ret;
  }
  
  _HVTsInServer(server) { //returns int
    if (!server) return 0;
	var ret=0;
	for (var j=0; j<server.root.length; j++) {
		if (this._isHVT(server.root[j])) ret++;
	}
	return ret;
  }
  
  _HVTsInstalled() { //returns int
	var ret=0;
	for (var i=0; i<corp.remoteServers.length; i++) {
		ret += this._HVTsInServer(corp.remoteServers[i]);
	}
	return ret;
  }
  
  _HVTserver() { //returns first one found
	  for (var i=0; i<corp.remoteServers.length; i++) {
		  for (var j=0; j<corp.remoteServers[i].root.length; j++) {
			if (this._isHVT(corp.remoteServers[i].root[j])) return corp.remoteServers[i];
		}
	  }
	  return null;
  }

  //optionally, specific an array of cards to ignore 
  _agendasInHand(ignoreCards=[]) { //returns int
    return this._agendasInServer(corp.HQ,ignoreCards);
  }

  //optionally, specific an array of cards to ignore 
  _HVTsInHand(ignoreCards=[]) { //returns int
    var ret = 0;
	for (var i=0; i<corp.HQ.cards.length; i++) {
		if (!ignoreCards.includes(corp.HQ.cards[i])) {
			if (this._isHVT(corp.HQ.cards[i])) ret++;
		}
	}
    return ret;
  }

  _faceDownCardsOrAgendasExistInArchives() {
    for (var i = 0; i < corp.archives.cards.length; i++) {
      if (!IsFaceUp(corp.archives.cards[i])) return true;
      if (CheckCardType(corp.archives.cards[i], ["agenda"])) return true;
    }
  }

  //highest amount to advance bluff to
  _bluffAdvanceLimit(card) {
	var advlim = 4; //advancing an ambush more that this is not a good bluff (most agendas are only 5 or less to score)
	if (typeof(card.AIAdvancementLimit) == 'function') advlim = card.AIAdvancementLimit.call(card);
	var hostileCards = corp.RnD.cards.concat(corp.HQ.cards).concat(corp.archives.cards);
	for (var k=0; k<hostileCards.length; k++) {
		if (CheckSubType(hostileCards[k],"Hostile")) {
			if (typeof(hostileCards[k].AIAdvancementLimit) == 'function') {
				var hostadvlim = hostileCards[k].AIAdvancementLimit.call(hostileCards[k]);
				if (hostadvlim > advlim) advlim = hostadvlim;
			}
		}
	}
	return advlim;
  }

  _remoteServerWithHighestIceAndRootProtection() {
	var ret = null;
	var highestIARP = 0;
	for (var i=0; i<corp.remoteServers.length; i++) {
		var thisIARP = this._iceAndRootProtection(corp.remoteServers[i]);
		if (thisIARP > highestIARP) {
			highestIARP = thisIARP;
			ret = corp.remoteServers[i];
		}
	}
	return ret;
  }

  _obsoleteBluff(card) {
    //if it's an ambush then no need to keep it if it is known or no longer a meaningful bluff
    if (CheckSubType(card, "Ambush") && CheckCardType(card, ["asset"])) {
	  var advlim = this._bluffAdvanceLimit(card);
      if (card.knownToRunner || card.advancement >= advlim) return true;
    }
    //other assets are worth less if they have been around while or there are lots of agendas in hand
	if (typeof(card.AITurnsInstalled) !== 'undefined') {
		var agendasInHand = this._agendasInHand();
		var agingFactor = card.AITurnsInstalled - 2; //arbitrary, test and tweak
		if (card.AIAvoidInstallingOverThis) agingFactor -= 4; //arbitrary, test and tweak
		if ( (agendasInHand > 0)&&(corp.HQ.cards.length - this._agendasInHand() < agingFactor) ) {
		  if (!CheckSubType(card, "Hostile") && CheckCardType(card, ["asset"])) {
			//most assets will still be overwritten if critical
			//(i.e. stop clogging up the strongest scoring server
			if (this._remoteServerWithHighestIceAndRootProtection() == GetServer(card)) return true;
			//check if it has AIAvoidInstallingOverThis: true
			if (card.AIAvoidInstallingOverThis) return false;
			//check if it has credits left
			if (!CheckCounters(card, "credits", 1)) {
				return true;
			}
		  }
		}
	}
    return false;
  }
  
  _obsoleteBluffInstalledInServer(server) {
	if (!server) return false;
	for (var i=0; i<server.root.length; i++) {
		if (this._obsoleteBluff(server.root[i])) return true;
	};
	return false;
  }

  _aCompatibleBreakerIsInstalled(
    iceCard //ignores strength and credit requirements
  ) {
    var installedRunnerCards = InstalledCards(runner);
    for (var i = 0; i < installedRunnerCards.length; i++) {
      if (CheckSubType(installedRunnerCards[i], "Icebreaker")) {
        if (
		  CheckSubType(installedRunnerCards[i], "AI") &&
		  !iceCard.cannotBreakUsingAIPrograms
		) 
		  return true;
        if (
          CheckSubType(installedRunnerCards[i], "Killer") &&
          CheckSubType(iceCard, "Sentry")
        )
          return true;
        if (
          CheckSubType(installedRunnerCards[i], "Decoder") &&
          CheckSubType(iceCard, "Code Gate")
        )
          return true;
        if (
          CheckSubType(installedRunnerCards[i], "Fracter") &&
          CheckSubType(iceCard, "Barrier")
        )
          return true;
      }
    }
    return false;
  }

  _numCompatibleIceInstalled(
    breakerCard //ignores strength and credit requirements
  ) {
    var ret = 0;
    var installedCorpCards = InstalledCards(corp);
    for (var i = 0; i < installedCorpCards.length; i++) {
      if (CheckCardType(installedCorpCards[i], ["ice"])) {
        if (
		  CheckSubType(breakerCard, "AI") &&
		  !installedCorpCards[i].cannotBreakUsingAIPrograms
		)
		  ret++;
        if (
          CheckSubType(breakerCard, "Killer") &&
          CheckSubType(installedCorpCards[i], "Sentry")
        )
          ret++;
        if (
          CheckSubType(breakerCard, "Decoder") &&
          CheckSubType(installedCorpCards[i], "Code Gate")
        )
          ret++;
        if (
          CheckSubType(breakerCard, "Fracter") &&
          CheckSubType(installedCorpCards[i], "Barrier")
        )
          ret++;
      }
    }
    return ret;
  }

  _cardProtectionValue(
    card //from 0 (completely pointless) to 2+ (depending on rez cost etc)
  ) {
    var ret = 0;
    if (CheckCardType(card, ["ice"])) {
		//if unrezzed and can't afford to rez, consider to be no protection (just a simple check ignoring cost of other ice in server)
		if ( card.rezzed || Credits(corp) >= RezCost(card)) {
			ret++; //1 point for any ice
			if (card.rezCost > 4 || Strength(card) > 3) {
			  ret++; //plus bonus point for high rez cost (based on printed value) or strong
			}
			//special case: ice wall gets extra strength for advancement tokens (constant is arbitrary)
			if (card.title == "Ice Wall") ret += 0.5 * card.advancement;
			//ice on centrals is essentially better due to the random 'mystery' nature of central servers
			var server = GetServer(card); //returns null if not installed
			if (server != null) {
			  if (typeof server.cards !== "undefined") ret += 2;
			  //stronger for each other ice in server
			  ret += 0.1*Math.sqrt(server.ice.length-1);
			}
			if (!card.rezzed) ret *= 1.5; //for being unrezzed (tweaked down from 2 because corp was overvaluing unrezzed ice)
			//weaker if threatened
			if (this._aCompatibleBreakerIsInstalled(card)) ret *= 0.5;
			//and modify value based on hosted cards and virus counters
			if (typeof card.hostedCards !== "undefined" && !card.AIDisablesHostedPrograms) {
			  for (var i = 0; i < card.hostedCards.length; i++) {
				if (card.hostedCards[i].player == corp) ret++;
				else {
				  ret--;
				  if (Counters(card.hostedCards[i], "virus") > 2) ret--;
				}
			  }
			}
		}
	}
	else if (CheckCardType(card, ["upgrade"])) {
		if (typeof card.AIDefensiveValue == 'function') {
			var defensiveValue = card.AIDefensiveValue.call(card, GetServer(card));
			//if unrezzed and can't afford to rez, consider to be no protection (just a simple check ignoring cost of other ice in server)
			if ( card.rezzed || Credits(corp) >= RezCost(card)) {
				ret += defensiveValue;
			}
		}
	}
    return ret;
  }
  
  _iceAndRootProtection(server) {
	var ret = 0;
    for (var i = 0; i < server.ice.length; i++) {
      ret += this._cardProtectionValue(server.ice[i]);
    }
    for (var i = 0; i < server.root.length; i++) {
      ret += this._cardProtectionValue(server.root[i]);
    }
	return ret;
  }

  _protectionScore(
    server, //higher number = more protected
	options //ignoreSuccessfulRuns, ignoreBackdoorFromArchives, returnArchivesLowerScoreForHQIfBackdoor
  ) {
	if (typeof options == 'undefined') {
		console.error("options not defined for call to corp.AI._protectionScore");
		options={};
	}
    //new servers have a score of 1 (because they are empty)
    if (server == null) return 1;
	var archivesIsBackdoorToHQ = this._archivesIsBackdoorToHQ();
	if (options.ignoreBackdoorFromArchives) archivesIsBackdoorToHQ = false;
    //for 'protecting' check we build a score considering how much ice and how effective the ice is
    var ret = 0;
	//servers with obsolete bluffs get bonus protection score (they don't really need protecting)
	if (this._obsoleteBluffInstalledInServer(server)) ret += 5; //the value is arbitrary, test and tweak
	//protection score depends on ice and upgrades protecting
	ret += this._iceAndRootProtection(server);
	if (!options.ignoreSuccessfulRuns) {
		//if it is being run successfully a lot, need extra protection
		var successfulRuns = 0;
		if (typeof server.AISuccessfulRuns !== "undefined") successfulRuns = server.AISuccessfulRuns;
		//if archives is a backdoor to HQ, consider successful runs on HQ
		if (server == corp.archives && archivesIsBackdoorToHQ && corp.HQ.AISuccessfulRuns !== "undefined") {
			if (corp.HQ.AISuccessfulRuns > successfulRuns) successfulRuns = corp.HQ.AISuccessfulRuns;
		}
		if (successfulRuns > 0) ret -= Math.round(Math.sqrt(successfulRuns));
	}
	//if it is archives we will deprioritise protection (if it is not a backdoor into HQ)
	if (server == corp.archives && !archivesIsBackdoorToHQ) ret += 3; //archives (the 3 is arbitrary)
	//if it is HQ (or backdoor), increase or decrease priorisation based on agenda points compared to cards in hand
	if (server == corp.HQ || (server == corp.archives && archivesIsBackdoorToHQ) ) ret += corp.HQ.cards.length - this._agendaPointsInServer(corp.HQ) - 2.5; //the subtracted value is arbitrary (with 2 the AI was underprotective of HQ)
	//if it is R&D and there is extra threat e.g. a Conduit, need more protection
	if (server == corp.RnD) {
	  ret -= this._extraThreatOnRnD();
	}
	if (options.returnArchivesLowerScoreForHQIfBackdoor) {
		//if it is HQ we will return the lowest protection of either HQ or Archives
		if (server == corp.HQ && archivesIsBackdoorToHQ) {
			var archivesProt = this._protectionScore(corp.archives,options);
			if (archivesProt < ret) ret = archivesProt;
		}
	}
    return ret;
  }
  
  //returns true if we don't want to add more protection to this server
  _NoMoreProtectionForThisServer(server) {
	if (!server) return false;
	//for now we'll just use this check to limit AIAvoidInstallingOverThis asset protection to 1 ice
	for (var i=0; i<server.root.length; i++) {
	  if ( server.root[i].cardType == "asset" && server.root[i].AIAvoidInstallingOverThis && server.ice.length > 0 ) {
		return true;
	  }
	}
	return false; //usually we are ok with adding more ice	  
  }

  _serverToProtect(
    ignoreArchives = false, //returns the server that most needs increased protection (does not return null, will be HQ by default or R&D against shapers)
	outputToLog = false
  ) {
    var protectionScores = {};

    var serverToProtect = corp.HQ;
    if (runner.identityCard.faction == "Shaper") serverToProtect = corp.RnD;
    var protectionScore = this._protectionScore(serverToProtect, {});

    protectionScores.HQ = this._protectionScore(corp.HQ, {});
    if (protectionScores.HQ < protectionScore) {
      serverToProtect = corp.HQ;
      protectionScore = protectionScores.HQ;
    }

    protectionScores.RnD = this._protectionScore(corp.RnD, {});
    if (protectionScores.RnD < protectionScore) {
      serverToProtect = corp.RnD;
      protectionScore = protectionScores.RnD;
    }
    for (var i = 0; i < corp.remoteServers.length; i++) {
      protectionScores[corp.remoteServers[i].serverName] =
        this._protectionScore(corp.remoteServers[i], {});
      if (this._isAScoringServer(corp.remoteServers[i]))
        protectionScores[corp.remoteServers[i].serverName] -=
          this._agendasInHand(); //scoring servers need more protection than other remotes (and the more agendas in hand, the more need to strengthen them
      if (
        protectionScores[corp.remoteServers[i].serverName] < protectionScore && !this._NoMoreProtectionForThisServer(corp.remoteServers[i])
      ) {
        serverToProtect = corp.remoteServers[i];
        protectionScore = protectionScores[corp.remoteServers[i].serverName];
      }
    }
    if (this._emptyProtectedRemotes().length == 0) {
      protectionScores["null"] = this._protectionScore(null, {});
      if (protectionScores["null"] < protectionScore) {
        serverToProtect = null;
        protectionScore = protectionScores["null"];
      }
    }
	if ( ( serverToProtect==null || typeof(serverToProtect.cards) == 'undefined' ) && this._HVTsInstalled() > 0 ) { //protect a HVT server instead of other remotes
		if (!this._HVTsInServer(serverToProtect)) { //this server is fine if it has a HVT
			//don't update the protection score - don't compare archives to the HVT server
			serverToProtect = this._HVTserver();
		}
	}
    if (!ignoreArchives) {
      protectionScores.archives = this._protectionScore(corp.archives, {});
      if (protectionScores.archives < protectionScore) {
        serverToProtect = corp.archives;
        protectionScore = protectionScores.archives;
      }
    }
    if (outputToLog) this._log("Server protection scores: " + JSON.stringify(protectionScores));
    return serverToProtect;
  }

  _bestProtectedRemote() { //returns the remote server that has the highest protection
    var bestProtectedRemote = null;
    var protectionScore = 0;
    for (var i = 0; i < corp.remoteServers.length; i++) {
      if (this._protectionScore(corp.remoteServers[i], {}) > protectionScore) {
        bestProtectedRemote = corp.remoteServers[i];
        protectionScore = this._protectionScore(bestProtectedRemote, {});
      }
    }
    return bestProtectedRemote;
  }

  _emptyProtectedRemotes() { //returns a list (strongest protection first) of remote servers which are empty (can contain upgrades or obsolete bluffs though) and have ice in front
    var ret = [];
    var protectionScores = [];
    for (var i = 0; i < corp.remoteServers.length; i++) {
      var hasRoom = true;
      for (var j = 0; j < corp.remoteServers[i].root.length; j++) {
        if (CheckCardType(corp.remoteServers[i].root[j], ["agenda", "asset"])) {
		  //replace obsolete bluffs
          if (!this._obsoleteBluff(corp.remoteServers[i].root[j]))
            hasRoom = false;
		  //but keep if useful for Trick of Light
		  else if (CheckCounters(corp.remoteServers[i].root[j], "advancement", 2) && this._copyOfCardExistsIn("Trick of Light",corp.HQ.cards.concat(corp.RnD.cards))) hasRoom = false;
        }
      }
      if (corp.remoteServers[i].ice.length > 0 && hasRoom) {
        //insert into ret in order by finding the relevant index
        var thisProtectionScore = this._protectionScore(corp.remoteServers[i], {});
        var k = 0;
        while (
          k < protectionScores.length &&
          protectionScores[k] > thisProtectionScore
        )
          k++;
        ret.splice(k, 0, corp.remoteServers[i]);
        protectionScores.splice(k, 0, thisProtectionScore);
      }
    }
    return ret;
  }

  //returns a list of remote servers which are not empty (contain an asset or agenda) and have ice in front
  //note that the nature and age of the assets is not considered (e.g. it may have an obsolete bluff)
  _nonEmptyProtectedRemotes() {
    //results are in no particular order
    var ret = [];
    for (var i = 0; i < corp.remoteServers.length; i++) {
      var hasRoom = true;
      for (var j = 0; j < corp.remoteServers[i].root.length; j++) {
        if (CheckCardType(corp.remoteServers[i].root[j], ["agenda", "asset"]))
          hasRoom = false;
      }
      if (corp.remoteServers[i].ice.length > 0 && !hasRoom)
        ret.push(corp.remoteServers[i]);
    }
    return ret;
  }

  _clickAbilityLikeAvailable(
    regexp //returns true if there is an active card with a valid click ability matching this pattern. regexp is an object not a string.
  ) {
    var activeCards = ActiveCards(corp);
    for (var i = 0; i < activeCards.length; i++) {
      var abilityChoices = ChoicesAbility(activeCards[i], true); //the true is 'click abilities only' (we are in main action phase)
      for (var j = 0; j < abilityChoices.length; j++) {
        if (regexp.test(abilityChoices[j].label)) return true;
      }
    }
    return false;
  }

  _rezzableNonIceCards() {
    var ret = [];
    var installedCards = InstalledCards(corp);
    for (var i = 0; i < installedCards.length; i++) {
      var card = installedCards[i];
      if (CheckRez(card, ["upgrade", "asset"])) {
        //does not check cost...
        var currentRezCost = RezCost(card); //...so we check that here
        if (CheckCredits(corp, currentRezCost, "rezzing", card)) ret.push(card);
      }
    }
    return ret;
  }

  _serverNotEmpty(server) {
    if (server.root.length > 0) return true;
    if (typeof server.cards !== "undefined") {
      //central
      if (server.cards.length > 0) return true;
    }
    return false;
  }

  //returns array of cards
  _copiesOfCardIn(title, cards) {
	var ret=[];
    for (var i = 0; i < cards.length; i++) {
      if (GetTitle(cards[i]) == title) ret.push(cards[i]);
    }
    return ret;
  }

  //returns card
  _copyOfCardExistsIn(title, cards) {
    for (var i = 0; i < cards.length; i++) {
      if (GetTitle(cards[i]) == title) return cards[i];
    }
    return null;
  }

  _rankedThreats() {
    var ret = InstalledCards(runner);
    //predetermine number of compatible ice installed (for icebreakers only)
    for (var i = 0; i < ret.length; i++) {
      if (CheckSubType(ret[i], "Icebreaker"))
        ret[i].AInumCompatibleIceInstalled = this._numCompatibleIceInstalled(
          ret[i]
        );
    }
    //printed install cost + hosted credits + hosted virus counters + ice threatened
    ret.sort(function (a, b) {
      var ascore = 0;
      if (typeof a.installCost !== "undefined") ascore += a.installCost;
      ascore += Counters(a, "credits");
      ascore += Counters(a, "virus");
      if (typeof a.AInumCompatibleIceInstalled !== "undefined")
        ascore += a.AInumCompatibleIceInstalled;
      var bscore = 0;
      if (typeof b.installCost !== "undefined") bscore += b.installCost;
      bscore += Counters(b, "credits");
      bscore += Counters(b, "virus");
      if (typeof b.AInumCompatibleIceInstalled !== "undefined")
        bscore += b.AInumCompatibleIceInstalled;
      return bscore - ascore; //descending order
    });
    return ret;
  }

  //this is used either for trash-on-install corp, or trash Runner cards
  _bestTrashOption(optionList) {
    var rankedThreats = this._rankedThreats();
    for (var j = 0; j < rankedThreats.length; j++) {
      for (var i = 0; i < optionList.length; i++) {
        if (typeof optionList[i].card !== "undefined") {
          if (optionList[i].card == rankedThreats[j]) return i;
        }
      }
    }
	//must be trash on install (comes here if there is no choice and something must be trashed)
	var toTrash = this.Phase_TrashBeforeInstall(optionList);
	if (toTrash > -1) return toTrash;
	//oh dear
    return 0; //arbitrary
  }

  //this will return index of best option, or -1 if none of them are acceptable
  //if inhibit is false, more willing installs are permitted (use this for free install&rez)
  _bestInstallOption(optionList,inhibit=true) {
    //make a cards list from optionList (since this could be hand, archives, card-generated list, etc)
    var cards = [];
    for (var i = 0; i < optionList.length; i++) {
      if (typeof optionList[i].card !== "undefined") {
        if (!cards.includes(optionList[i].card)) {
			cards.push(optionList[i].card);
		}
      }
    }
    //now rank them
    var rankedInstallOptions = this._rankedInstallOptions(cards,false,inhibit);
    for (var j = 0; j < rankedInstallOptions.length; j++) {
      for (var i = 0; i < optionList.length; i++) {
        if (
          optionList[i].card == rankedInstallOptions[j].cardToInstall &&
          optionList[i].server == rankedInstallOptions[j].serverToInstallTo
        ) {
          return i;
		}
      }
    }
	//no desirable option
    return -1;
  }

  //array of titles of economy cards
  _economyCards(affordableOnly=false) {
	var economyCards = [];
	if (!affordableOnly || corp.creditPool >= 3) economyCards.push("Celebrity Gift"); //we have this first because playing other cards first would reduce cards in hand
	var subliminal = this._copyOfCardExistsIn("Subliminal Messaging", AllCards(corp));
	if (subliminal && !subliminal.copyPlayedThisTurn) economyCards.push("Subliminal Messaging"); //this is next priority because it gives the click back
    if (!affordableOnly || corp.creditPool >= 10) economyCards.push("Government Subsidy");
    if (!affordableOnly || corp.creditPool >= 5) economyCards.push("Hedge Fund");
    if ( (!affordableOnly || corp.creditPool >= 5) && (this._agendasInHand() < corp.HQ.cards.length - 1) )
      economyCards.push("Hansei Review"); //only if there is at least 1 non-agenda card (other than this) in HQ
    if (!affordableOnly || corp.creditPool >= 2) economyCards.push("Marilyn Campaign");
    if (!affordableOnly || corp.creditPool >= 3) economyCards.push("Regolith Mining License");
    if (!affordableOnly || corp.creditPool >= 2) economyCards.push("Nico Campaign");
    if (!affordableOnly || corp.creditPool >= 2) economyCards.push("PAD Campaign");
    if (corp.creditPool < corp.HQ.cards.length) economyCards.push("Predictive Planogram"); //simple check whether to use for econ or save for draw
	return economyCards;
  }

  //enact best economy (called from main phase)
  _bestMainPhaseEconomyOption(optionList) {
    var installedCards = InstalledCards(corp);

	//special case: Oaktown Renovation is installed
	if (optionList.indexOf("advance") > -1) {
		var oaktown = this._copyOfCardExistsIn("Oaktown Renovation", installedCards);
		if (oaktown) return this._returnPreference(optionList, "advance", {
			cardToAdvance: oaktown,
		});
	}
	
    //if a click economy ability exists, use that
    if (optionList.indexOf("trigger") > -1) {
      var regexp = new RegExp(/(gain|take)\s*\d*\s*\[c\]/, "gmi");
      if (this._clickAbilityLikeAvailable(regexp)) {
        this._log("a click ability could provide economy");
        return optionList.indexOf("trigger");
      }
    }

    var emptyProtectedRemotes = this._emptyProtectedRemotes();

    //if an economy card is in hand, play/install it (this list is in order of preference)
    //list of economy cards (by title)
    //could implement these on-card instead? (e.g. as AIEconomyCard) and move the check functions to there or Enumerate
    var canPlay = optionList.indexOf("play") > -1;
    var canInstall = optionList.indexOf("install") > -1;
    var economyCards = this._economyCards();

    for (var j = 0; j < economyCards.length; j++) {
      for (var i = 0; i < corp.HQ.cards.length; i++) {
        if (economyCards[j] == GetTitle(corp.HQ.cards[i])) {
          if (
            corp.HQ.cards[i].cardType == "operation" &&
            canPlay &&
            FullCheckPlay(corp.HQ.cards[i])
          ) {
            this._log(GetTitle(corp.HQ.cards[i]) + " might be good economy play?");
            return this._returnPreference(optionList, "play", {
              cardToPlay: corp.HQ.cards[i],
            });
          } else if (corp.HQ.cards[i].cardType != "operation" && canInstall) {
            if (corp.HQ.cards[i].cardType != "upgrade") {
			  var prefToReturn = null;
			  //custom install checks?
			  if (typeof corp.HQ.cards[i].AIWorthInstalling == "function") {
				  var installPreference = corp.HQ.cards[i].AIWorthInstalling(
					emptyProtectedRemotes
				  );
				  if (installPreference > -1) {
					if (installPreference > emptyProtectedRemotes.length - 1)
					  prefToReturn = { cardToInstall: corp.HQ.cards[i], serverToInstallTo: null };
					//new server
					else
					  prefToReturn = {
						cardToInstall: corp.HQ.cards[i],
						serverToInstallTo: emptyProtectedRemotes[installPreference],
					  };
				  }
			  }
			  //or just default checks
			  else {
				  var preferredServer = null; //install into new if necessary
				  if (emptyProtectedRemotes.length > 0)
					preferredServer = emptyProtectedRemotes[0];
				    prefToReturn = {
					  cardToInstall: corp.HQ.cards[i],
					  serverToInstallTo: preferredServer,
				    };
			  }
			  if (prefToReturn != null) {
				  this._log(GetTitle(corp.HQ.cards[i]) + " might be good economy install?");
				  return this._returnPreference(optionList, "install", prefToReturn);
			  }
            } //upgrades
            else {
              var preferredServer = this._preferredServerToUpgrade(
                corp.HQ.cards[i]
              );
              if (
                this._shouldUpgradeServerWithCard(
                  preferredServer,
                  corp.HQ.cards[i]
                )
              ) {
                this._log(
                  GetTitle(corp.HQ.cards[i]) + " might be good economy upgrade?"
                );
                return this._returnPreference(optionList, "install", {
                  cardToInstall: corp.HQ.cards[i],
                  serverToInstallTo: preferredServer,
                });
              }
            }
          }
        }
      }
    }

    //if an econ card is installed but we need a little more cred to use it, click for cred
    for (var i = 0; i < installedCards.length; i++) {
      if (CheckRez(installedCards[i], ["ice", "asset", "upgrade"])) {
        //if a rezzable card...
        if (economyCards.includes(GetTitle(installedCards[i]))) {
          //is an economy card
          var currentRezCost = RezCost(installedCards[i]);
          if (
            CheckCredits(corp, currentRezCost, "rezzing", installedCards[i])
          ) {
            //can afford to rez for econ
            if (optionList.includes("rez")) {
              this._log("Rez might help econ");
              return this._returnPreference(optionList, "rez", {
                cardToRez: installedCards[i],
              });
            }
          } //maybe can click for credits to afford its rez
          else {
            var credDiff = currentRezCost - Credits(corp);
            if (credDiff > 0 && credDiff <= this._clicksLeft()) {
              this._log("Just need a little more cred...");
              return optionList.indexOf("gain");
            }
          }
        }
      }
    }

    //if space in hand, try to draw for econ card
    if (MaxHandSize(corp) - PlayerHand(corp).length > 0) {
      this._log("Maybe could draw an economy card?");
      //use a card ability first if one exists
      var canPlay = optionList.indexOf("play") > -1;
      var drawCards = [];

	  drawCards.push("Spin Doctor");
      drawCards.push("Sprint");
	  drawCards.push("Daily Business Show");
	  if (corp.HQ.cards.length < corp.creditPool) drawCards.push("Predictive Planogram"); //simple check whether to use for draw or save for econ

	  //maybe something to rez
      if (optionList.includes("rez")) {
      for (var i = 0; i < installedCards.length; i++) {
        if (CheckRez(installedCards[i], ["ice", "asset", "upgrade"])) {
          //if a rezzable card...
          if (drawCards.includes(GetTitle(installedCards[i]))) {
            //is an draw card
            var currentRezCost = RezCost(installedCards[i]);
            if (
              CheckCredits(corp, currentRezCost, "rezzing", installedCards[i])
            ) {
              //can afford to rez for draw
                this._log("Rez might help draw");
                return this._returnPreference(optionList, "rez", {
                  cardToRez: installedCards[i],
                });
              }
			}  
		  }
		}
	  }

	  //or something to play
      for (var j = 0; j < drawCards.length; j++) {
        for (var i = 0; i < corp.HQ.cards.length; i++) {
          if (drawCards[j] == GetTitle(corp.HQ.cards[i])) {
            if (corp.HQ.cards[i].cardType == "operation" && canPlay) {
              this._log(GetTitle(corp.HQ.cards[i]) + " might be good draw?");
              return this._returnPreference(optionList, "play", {
                cardToPlay: corp.HQ.cards[i],
              });
            }
          }
        }
      }

      //otherwise just basic action is fine, unless last click and potentially bringing an agenda into weaker protection
      var drawIsOK = true;
	  if (this._clicksLeft() < 2) {
		  if (this._protectionScore(corp.HQ, {returnArchivesLowerScoreForHQIfBackdoor:true}) < this._protectionScore(corp.RnD, {})) {
			  drawIsOK = false;
			  this._log("But no I don't want to draw right now");
		  }
	  }
	  if (drawIsOK) return optionList.indexOf("draw");
    }

    //last resort - click for cred
    this._log("Nothing good to do...");
    if (optionList.indexOf("gain") > -1) return optionList.indexOf("gain");

    this._log(
      "No desired install options were available, using arbitrary option."
    );
    return 0;
  }

  _sufficientEconomy(
    tight = true,
    buffer = 0 //return true if there is enough, false if we need more cred supply
  ) {
    //currently going to do this fairly naively by just getting total of
    //if tight, just the top three most expensive cards installed, plus ambushes
    //adds buffer to requirement
    var totalCost = 0;

    //rezzable cards
    var installedCards = InstalledCards(corp);
    var rezCosts = [];
    for (var i = 0; i < installedCards.length; i++) {
      if (CheckRez(installedCards[i], ["asset", "upgrade"])) {
        //if a rezzable card in root
        rezCosts.push(RezCost(installedCards[i])); //...then add its cost
      } else if (CheckRez(installedCards[i], ["ice"])) {
        //if a rezzable ice
        //only critically need to rez if protecting something (but include cost anyway if not checking tight economy)
        if (this._serverNotEmpty(GetServer(installedCards[i])) || !tight)
          rezCosts.push(RezCost(installedCards[i])); //...then add its cost
      }
    }
    var countLimit = rezCosts.length;
    if (tight) countLimit = 3; //choose the top three
    //sort and add to our required budget
    rezCosts.sort(function (a, b) {
      return b - a;
    });
    for (var i = 0; i < rezCosts.length && i < countLimit; i++) {
      totalCost += rezCosts[i];
    }

    //can I afford to rez/use all my ambushes, upgrades and hostiles?
    var rootUseCosts = [
      { title: "Aggressive Secretary", cost: 2 },
      { title: "Ghost Branch", cost: 0 },
      { title: "Project Junebug", cost: 1 },
      { title: "Snare!", cost: 4 },
      { title: "Urtica Cipher", cost: 0 },
      { title: "Manegarm Skunkworks", cost: 2 },
      { title: "Anoetic Void", cost: 0 },
      { title: "Clearinghouse", cost: 0 },
	  { title: "Ronin", cost: 0 },
      { title: "Hokusai Grid", cost: 2 },
	  { title: "Reversed Accounts", cost: 0 },
	  { title: "SanSan City Grid", cost: 6 },
      { title: "Crisium Grid", cost: 3 },
    ];
    for (var i = 0; i < corp.remoteServers.length; i++) {
      for (var j = 0; j < corp.remoteServers[i].root.length; j++) {
        for (var k = 0; k < rootUseCosts.length; k++) {
          if (GetTitle(corp.remoteServers[i].root[j]) == rootUseCosts[k].title)
            totalCost += rootUseCosts[k].cost;
        }
      }
    }

	if (totalCost > 12 && Credits(corp) > Credits(runner)) totalCost = 12; //reduce chance Corp will get stuck

    if (Credits(corp) < totalCost + buffer) return false; //note this doesn't include effects e.g. that might increase effective credits

    //economy looking good
    return true;
  }

  //used in _rankedInstallOptions
  _iceInstallOptions(serverToInstallTo, cards, priorityOnly) {
	var ret = [];
    //only create new empty protected remotes when there will be corp clicks to use them (e.g. not during Ansel firing) and not while a HVT is installed
	var permitNewEmpty = false;
	if (this._HVTsInstalled() == 0 && this._clicksLeft() > 1) permitNewEmpty = true;
	if (serverToInstallTo !== null || permitNewEmpty) {
		var affordableIce = this._affordableIce(serverToInstallTo, cards);
		for (var i = 0; i < affordableIce.length; i++) {
		  ret.push({
			cardToInstall: affordableIce[i],
			serverToInstallTo: serverToInstallTo,
		  });
		}
		if (!priorityOnly) {
			var notAffordableIce = this._notAffordableIce(serverToInstallTo, cards);
			for (var i = 0; i < notAffordableIce.length; i++) {
			  ret.push({
				cardToInstall: notAffordableIce[i],
				serverToInstallTo: serverToInstallTo,
			  });
			}
		}
	}
	return ret;
  }	  

  _rankedInstallOptions(
    cards, //return list of preferred install options (0 highest preference) or empty array if don't want to install
	priorityOnly=false, //set true to exclude low priorities like unaffordable ice or non-ice into new server
	inhibit=true, //if inhibit is false, more willing installs are permitted (use this for free install&rez)
  ) {
    var ret = [];
	
	var strongestEmptyRemote = null;
    var emptyProtectedRemotes = this._emptyProtectedRemotes(); //sorted strongest protection first
	if (emptyProtectedRemotes.length > 0) strongestEmptyRemote = emptyProtectedRemotes[0];
	
	//Check for this-turn win conditions
	var potentialAdvancement = this._potentialAdvancement(null,Infinity,true);
	//check for cards in hand that could be installed and fast-advanced to win
	for (var i=0; i<corp.HQ.cards.length; i++) {
		var card = corp.HQ.cards[i];
		if (CheckCardType(card,["agenda"])) {
			if (AgendaPoints(corp) + card.agendaPoints >= AgendaPointsToWin()) {
			  if (this._advancementLimit(card,strongestEmptyRemote) <= potentialAdvancement) {
				  ret.push({
					cardToInstall: card,
					serverToInstallTo: strongestEmptyRemote,
					reason: "could be installed and fast-advanced to win",
				  });
			  }
			}
		}
	}
	
    //Check if there are any assets in cards that are worth installing
    //Include relevant checks in their function e.g. emptyProtectedRemotes.length > 0
    //And return -1 (don't install), 0 to emptyProtectedRemotes.length-1 (install in this server), or emptyProtectedRemotes.length (install in a new server)
    for (var i = 0; i < cards.length; i++) {
      if (!this._uniqueCopyAlreadyInstalled(cards[i])) {
        if (typeof cards[i].AIWorthInstalling == "function") {
          var installPreference = cards[i].AIWorthInstalling(
            emptyProtectedRemotes
          );
          if (installPreference > -1) {
            if (installPreference > emptyProtectedRemotes.length - 1)
              ret.push({ cardToInstall: cards[i], serverToInstallTo: null, reason: "AIWorthInstalling returned new server", });
            //new server
            else
              ret.push({
                cardToInstall: cards[i],
                serverToInstallTo: emptyProtectedRemotes[installPreference],
				reason: "AIWorthInstalling returned existing server",
              });
          }
        }
      }
    }

	//An economy check used to prioritise whether to install ice (the 4 is arbitrary)
	var iceInstallEconomyCheck = this._sufficientEconomy(false, 4);

    //Find out if any servers need protection. If so, we will choose an ice card if possible.
    var serverToInstallTo = this._serverToProtect();

	//Simple situational checks
	//ice is all rezzed? need to install another layer (or any at all)
	var iceInstallSituationCheck = this._unrezzedIce(serverToInstallTo).length == 0;
	//too poor? don't spend frivolously on new layers
	if (!iceInstallEconomyCheck && this._rezzedIce(serverToInstallTo).length > 0) iceInstallSituationCheck = false;

    if (
      iceInstallSituationCheck ||
      iceInstallEconomyCheck
    ) {
      //this is our worst-protected server. if the server already has unrezzed ice, let's not install ice unless we have economy
      //prioritise placing ice that I can afford to rez (for now we make no effort to sort them)
	  var iceInstallOptions = this._iceInstallOptions(serverToInstallTo, cards, priorityOnly);
	  for (var i=0; i<iceInstallOptions.length; i++) {
		iceInstallOptions[i].reason = "returned by _iceInstallOptions for server that needs protection";
	  }
	  ret = ret.concat(iceInstallOptions);
    }
    //Installing ice is unnecessary or impossible,maybe install something else into a server
	//choose an card and server to install to
    var scoringServers = this._scoringServers(emptyProtectedRemotes);
	var intoServerOptions = [];
	for (var i = 0; i < cards.length; i++) {
		if (this._isHVT(cards[i])) {
		  //loop through scoring servers
		  for (var j = 0; j < scoringServers.length; j++) {
			serverToInstallTo = scoringServers[j];
			intoServerOptions.push({
				cardToInstall: cards[i],
				serverToInstallTo: serverToInstallTo,
				reason: "HVT into scoring server",
			});
		  }
		} else if (CheckCardType(cards[i], ["asset"])) {
		  //if installing from archives, creating a new server is fine (what's to lose? uh except: when needed, add an exception for 'trashed while being accessed' cards)
		  var assetDestinations = emptyProtectedRemotes;
		  if (assetDestinations.length < 2) {
			if (cards[i].cardLocation == corp.archives.cards || cards[i].cardLocation == corp.resolvingCards) assetDestinations = assetDestinations.concat([null]);
		  }
		  //loop through empty remotes in random order (skip strongest empty remote)
		  Shuffle(assetDestinations);
		  for (var j = 0; j < assetDestinations.length; j++) {
			serverToInstallTo = assetDestinations[j];
			if (serverToInstallTo != strongestEmptyRemote) {
			  intoServerOptions.push({
				cardToInstall: cards[i],
				serverToInstallTo: serverToInstallTo,
				reason: "asset into non-scoring server",
			  });
			}
		  }
		}
	}
	
	//determine upgrade choices before agenda choices in case there is a scoring upgrade
    serverToInstallTo = this._bestProtectedRemote();
    if (serverToInstallTo == null || (serverToInstallTo.root.length < 1 && this._agendasInHand() < 1) )
      serverToInstallTo = this._serverToProtect();
	var upgradeInstallPreferences = this._upgradeInstallPreferences(serverToInstallTo, cards, inhibit);
	for (var i=0; i<upgradeInstallPreferences.length; i++) {
		upgradeInstallPreferences[i].reason = "returned by _upgradeInstallPreferences";
	}

	//calculate scoring window for each scoring server (by index in scoringServers)
	var scoringWindows = [];
	for (var i=0; i<scoringServers.length; i++) {
		scoringWindows.push(this._scoringWindow(scoringServers[i]));
	}
	this._log("Scoring windows for empty servers: "+JSON.stringify(scoringWindows));
	//sort options based on scoring window (closest to scoring window value is best i.e. first)
	intoServerOptions.sort(function(a,b) {
		var aAdvReq = corp.AI._advancementLimit(a.cardToInstall, a.serverToInstallTo);
		var bAdvReq = corp.AI._advancementLimit(b.cardToInstall, b.serverToInstallTo);
		var aWindow = 0;
		var bWindow = 0;
		for (var i=0; i<scoringServers.length; i++) {
			if (scoringServers[i] == a.serverToInstallTo) aWindow = scoringWindows[i];
			if (scoringServers[i] == b.serverToInstallTo) bWindow = scoringWindows[i];
		}
		var aDiff = Math.abs(aAdvReq - aWindow); 
		var bDiff = Math.abs(bAdvReq - bWindow); 
		return (aDiff - bDiff);
	});
	//this._log(JSON.stringify(intoServerOptions));
	var preferUpgrade = false;
	if (upgradeInstallPreferences.length > 0 && intoServerOptions.length > 0) {
		if (upgradeInstallPreferences[0].serverToInstallTo == intoServerOptions[0].serverToInstallTo) {
			if (upgradeInstallPreferences[0].cardToInstall.AIIsScoringUpgrade) preferUpgrade = true;
		}
	}
	if (!preferUpgrade) ret = ret.concat(intoServerOptions);

    //Upgrade? Not if poor (assuming there are no upgrades that improve economy)
	if (iceInstallEconomyCheck) ret = ret.concat(upgradeInstallPreferences);
	if (preferUpgrade) ret = ret.concat(intoServerOptions);

    //If no protected empty remote exists, let's make one if prudent
	//otherwise just add ice to whatever server needs it most
    serverToInstallTo = null;
    if (emptyProtectedRemotes.length > 0)
      serverToInstallTo = this._serverToProtect();
    //but don't create a new server if the above economy check failed
	//because we might be saving to afford better ice in critical server
	if (serverToInstallTo != null || iceInstallEconomyCheck) {
	  var iceInstallOptions = this._iceInstallOptions(serverToInstallTo, cards, priorityOnly);
	  for (var i=0; i<iceInstallOptions.length; i++) {
		iceInstallOptions[i].reason = "returned by _iceInstallOptions for new server";
	  }
	  ret = ret.concat(iceInstallOptions);
	}
	
	//or even maybe...these?
	var snare = this._copyOfCardExistsIn("Snare!",cards);
	if (snare && !PlayerCanLook(runner,snare) && AvailableCredits(corp,"using",snare) > 3) ret.push({
		cardToInstall: snare,
		serverToInstallTo: strongestEmptyRemote,
		reason: "Specific case",
	});
	
	/*
	if (priorityOnly) console.error("-Priority only-");
	else console.error("-Any priority-");
	for (var i=0; i<cards.length; i++) {
		var listed=false;
		for (var j=0; j<ret.length; j++) {
			if (ret[j].cardToInstall == cards[i]) listed = true;
		}
		console.error((listed?"*":"")+cards[i].title);
	}
	*/
    return ret;
  }

  _clicksLeft() {
    return corp.clickTracker;
  }

  //**CORP PHASE RESPONSES**
  //(these take optionList as input, and return index of choice)
  Phase_Mulligan(optionList) {
    //check there is enough ice
    if (this._affordableIce(null).length < 2) {
      this._log("Didn't draw enough ice");
      return optionList.indexOf("m");
    }
    //check there aren't too many agendas in hand
    var agendasInHand = 0;
    for (var i = 0; i < corp.HQ.cards.length; i++) {
      if (corp.HQ.cards[i].cardType == "agenda") agendasInHand++;
    }
    if (agendasInHand > 2) {
      this._log("Drew too many agendas");
      return optionList.indexOf("m");
    }
    this._log("This hand will do");
    return optionList.indexOf("n"); //not mulligan
  }
  
  _isAmbush(server) {
	  for (var i=0; i<server.root.length; i++) {
		  if (CheckSubType(server.root[i],"Ambush")) return true;
	  }
	  return false;
  }
  
  //if the runner is running on an ambush server, don't stop them unless it will be obvious
  _iceToLeaveUnrezzed(server) {
	var ret = null;
	if ( server==attackedServer && Credits(corp) < 6 && this._isAmbush(server) ) {
		for (var i=0; i<server.ice.length; i++) {
			var card = server.ice[i];
			if (!card.rezzed) {
				for (var j=0; j<card.subroutines.length; j++) {
					//choose the highest cost ice with an etr subroutine to leave unrezzed
					if (card.subroutines[j].text.includes("nd the run")) {
						if (!ret) ret = card;
						else if (RezCost(card) > RezCost(ret)) ret = card;
					}
				}
			}
		}
	}	
	return ret;
  }

  _runnerMayWinIfServerBreached(server) {
	  if (!server) return false;
	  if (AgendaPoints(runner) + this._agendaPointsInServer(server) >= AgendaPointsToWin()) return true;
	  return false;
  }

  //returns the ice position in the given server
  //if server is null, 0 is returned
  //if ice is not in the server, server.ice.length is returned
  _icePositionInServer(iceCard, server) {
	  if (!server) return 0;
	  var iceIndex = server.ice.indexOf(iceCard);
	  if (iceIndex > -1) return iceIndex;
	  return server.ice.length;
  }

  //returns true to rez, false not to
  //passing the rez cost is an optimisation
  //input server to hypothesise if the ice isn't installed yet
  _iceWorthRezzing(card, currentRezCost, server) {
	  var rezIce = true;
	  if (typeof server == 'undefined') server = GetServer(card);
	  if (typeof currentRezCost == 'undefined') {
		  currentRezCost = RezCost(card);
	  }
	  //make sure there isn't better ice behind or in another server this will prevent us from rezzing
	  //for optimisation, we'll make a list of unrezzed ice with {card, server, cost, value} where value is the server value
	  var iceToCompareList = [];
	  var thisServerValue = this._serverValue(server);
	  //behind this ice (if the server exists)
	  if (server) {
	    var thisIcePosition = this._icePositionInServer(card, server);
	    for (var i=thisIcePosition-1; i>-1; i--) {
		  if (!server.ice[i].rezzed) {
			iceToCompareList.push({card:server.ice[i], server:server, cost:RezCost(server.ice[i]), value:thisServerValue});
		  }
		}
	    //include ambushes with costs as pretend ice of infinite value in this server
		var costyAmbushes = [{title:"Snare!",cost:4}];
		for (var i=0; i<costyAmbushes.length; i++) {
			var arrayToCheck = server.root;
			if (typeof server.cards != 'undefined') arrayToCheck = arrayToCheck.concat(server.cards);
			var cocin = this._copyOfCardExistsIn(costyAmbushes[i].title,arrayToCheck);
			if (cocin) iceToCompareList.push({card:cocin, server:server, cost:costyAmbushes[i].cost, value:Infinity});
		}
	  }	  
	  //in another server (if Runner has clicks to potentially run it)
	  if (runner.clickTracker > 0) {
		  //start by making a list of servers to compare
		  var serversToCompare = [];
		  if (corp.archives !== server) serversToCompare.push(corp.archives);
		  if (corp.RnD !== server) serversToCompare.push(corp.RnD);
		  if (corp.HQ !== server) serversToCompare.push(corp.HQ);
		  for (var i=0; i<corp.remoteServers.length; i++) {
			if (corp.remoteServers[i] !== server) {
				serversToCompare.push(corp.remoteServers[i]);
			}
		  }
		  //now loop through the ice in all those servers, adding to unrezzed ice list
		  for (var i=0; i<serversToCompare.length; i++) {
			  var serverToCompare = serversToCompare[i];
			  var comparisonValue = this._serverValue(serverToCompare);
			  for (var j=0; j<serverToCompare.ice.length; j++) {
				if (!serverToCompare.ice[j].rezzed) {
					iceToCompareList.push({card:serverToCompare.ice[j], server:serverToCompare, cost:RezCost(serverToCompare.ice[j]), value:comparisonValue});
				}
			  }
		  }
	  }
	  //list of ice to compare is made, now compare
	  var thisIceProtectionValue = this._cardProtectionValue(card);
	  for (var i=0; i<iceToCompareList.length; i++) {
		var iceToCompare = iceToCompareList[i].card;
		var serverToCompare = iceToCompareList[i].server;
		var rezCostToCompare = iceToCompareList[i].cost;
		var valueToCompare = iceToCompareList[i].value;
		//only check ice that could be rezzed if we don't rez this
		if (CheckCredits(corp, rezCostToCompare, "rezzing")) {
		  //but couldn't be rezzed if we do rez this
		  if (!CheckCredits(corp, currentRezCost+rezCostToCompare, "rezzing")) {
			//save credits for that ice if the server value is greater, or if server value equal and ice value greater
			if ( (valueToCompare > thisServerValue) ||
			  ((valueToCompare == thisServerValue) && (this._cardProtectionValue(iceToCompare) > thisIceProtectionValue)) ) {
				this._log("Rez cost not worth it, need to save it for "+iceToCompare.title+" in "+ServerName(serverToCompare));
				rezIce = false;
			}
			else this._log("Rez this is better than "+iceToCompare.title+" in "+ServerName(serverToCompare));
		  }
		}
	  }
	  //also consider if there is a defensive upgrade worth rezzing in this server instead
	  for (var i=0; i<server.root.length; i++) {
		if (!server.root[i].rezzed) {
		  if (typeof server.root[i].AIDefensiveValue == 'function' && server.root[i].AIDefensiveValue.call(server.root[i], server) > 0) {
			if (!CheckCredits(corp, currentRezCost+RezCost(server.root[i]), "rezzing")) {
			  if (this._cardProtectionValue(server.root[i]) > thisIceProtectionValue) {
				this._log("Rez cost not worth it, need to save it for "+server.root[i].title+" in this server");
				rezIce = false;
			  }
			  else this._log("Rez this is better than "+server.root[i].title+" in this server");
			}
		  }
		}
	  }
	  //some reasons not to rez apply in general but not if breaching could mean game loss
	  if (!this._runnerMayWinIfServerBreached(server)) {
		//check for on-card not-worthwhile reason
		if (typeof card.AIWorthwhileIce == 'function') {
			if (!card.AIWorthwhileIce.call(card,server,"rez")) {
				this._log("Would be better not to rez this ice quite yet");
				rezIce = false;
			}
		}
		//ignore effect of hosted cards for some ice e.g. Magnet
		if (!card.AIDisablesHostedPrograms) {
		  //if a card is hosted (e.g. Tranquilizer) only rez if super rich (the *5 is arbitrary, observe and tweak)
		  if ( (typeof(card.hostedCards) !== 'undefined') && (card.hostedCards.length > 0) && (Credits(corp) < currentRezCost*5) ) {
			  rezIce = false;
		  }
		}
	  }
	  //there may be other reasons to leave this ice unrezzed (e.g. allow into an ambush)
	  if (this._iceToLeaveUnrezzed(server) == card) {
		  rezIce = false;
	  }
	  //special exceptions:
	  if (runner.resolvingCards.length > 0) {
		  var copyOfInsideJob = this._copyOfCardExistsIn("Inside Job", runner.resolvingCards);
		  if (copyOfInsideJob) {
			if (!copyOfInsideJob.encounteredIceThisRun) {
				var indexInServer = server.ice.indexOf(card);
				if (indexInServer == 0 || !server.ice[indexInServer-1].rezzed && corp.creditPool < RezCost(card) + RezCost(server.ice[indexInServer-1])) {
					if (typeof card.automaticOnRez == 'undefined' 
					  && typeof card.responseOnRez == 'undefined') {
					  //if this is first and only ice that would be encountered during an inside job,
					  //  only rez it if there is some other benefit
					  rezIce = false;
					}
				}
			}
		  }
	  }
	  /*
	  //TODO check this doesn't override false with true (or just return above if false?)
	  if (GetTitle(card) == "Cell Portal") {
		//only rez cell portal if it is behind at least one rezzed ice
		rezIce = false;
		for (var i = approachIce + 1; i < server.ice.length; i++) {
		  if (server.ice[i].rezzed)
			rezIce = true;
		}
	  }
	  if (GetTitle(card, true) == "Chum") {
		//only rez chum if it is in front of at least one ice (either rezzed or we can afford its rez cost as well as chum)
		//(in general the chum AI isn't well done...for example might play this ice as the first in the server...)
		rezIce = false;
		for (var i = approachIce - 1; i > -1; i--) {
		  var iceBehind = server.ice[i];
		  if (
			iceBehind.rezzed ||
			CheckCredits(
			  corp,
			  currentRezCost + RezCost(iceBehind),
			  "rezzing",
			  iceBehind
			)
		  )
			rezIce = true;
		}
	  }
	  */
	  return rezIce;
  }

  Phase_Approaching(optionList) {
    //if there is something that can be rezzed...only bother if the server isn't empty
    if (
      optionList.indexOf("rez") > -1 &&
      this._serverNotEmpty(attackedServer)
    ) {
      //lets check if the ice being approached can be rezzed:
      var card = attackedServer.ice[approachIce];
      if (CheckRez(card, ["ice"])) {
        //does not check cost...
        var currentRezCost = RezCost(card); //...so we check that here
        if (CheckCredits(corp, currentRezCost, "rezzing", card)) {
          //so we've checked and the ice can be rezzed. but should we?
          if (this._iceWorthRezzing(card, currentRezCost)) {
            this._log("I will rez the approached ice");
            return this._returnPreference(optionList, "rez", {
              cardToRez: card,
            });
          }
        }
      }
      //non-ice cards to rez when approaching ice:
	  //currently only accepts cards which have RezUsability defined
      for (var i=0; i<attackedServer.root.length; i++) {
		  var card = attackedServer.root[i];
		  if (typeof card.RezUsability == "function") {
			  if (card.RezUsability.call(card)) {
				return this._returnPreference(optionList, "rez", {
				  cardToRez: card,
				});
			  }
		  }
	  }
    }

	//something that could be triggered?
	//for now assume trigger is always desired
    if (optionList.indexOf("trigger") > -1) {
		return optionList.indexOf("trigger");
	}
	  
    return optionList.indexOf("n");
  }

  Phase_Movement(optionList) {
    //consider whether we should do anything or just let runner approach (the next ice, or the server)
    if (approachIce < 1) {
      //passing final ice of server (if any), last chance to rez defensive upgrades and use relevant assets
      //defensive upgrades
      for (var i = 0; i < attackedServer.root.length; i++) {
        var card = attackedServer.root[i];
        var wouldTriggerThis = false;
        if (typeof card.AIWouldTrigger == "function")
          wouldTriggerThis = card.AIWouldTrigger.call(card);
        if (wouldTriggerThis) {
          //make sure we can do it
          if (CheckRez(card, ["upgrade","asset"])) {
            //does not check cost...
            var currentRezCost = RezCost(card); //...so we check that here
            if (CheckCredits(corp, currentRezCost, "rezzing", card))
              return this._returnPreference(optionList, "rez", {
                cardToRez: card,
              });
          }
        }
      }
      //other assets (not necessarily in the attacked server)
      var rezzableNonIceCards = this._rezzableNonIceCards();
      //Spin Doctor: when the runner is approaching this or Archives
      var copyOfCard = this._copyOfCardExistsIn(
        "Spin Doctor",
        rezzableNonIceCards
      );
      if (copyOfCard) {
        var wouldTriggerThis = false;
        if (attackedServer == GetServer(copyOfCard)) wouldTriggerThis = true;
        else if (
          attackedServer == corp.archives &&
          this._faceDownCardsOrAgendasExistInArchives()
        )
          wouldTriggerThis = true;
        if (wouldTriggerThis)
          return this._returnPreference(optionList, "rez", {
            cardToRez: copyOfCard,
          });
      }
    }

    //if trigger is an option, use it by default
    if (optionList.indexOf("trigger") > -1)
      return optionList.indexOf("trigger");

    return optionList.indexOf("n");
  }

  Phase_EOT(
    optionList //that is, end of Runner turn
  ) {
    if (optionList.indexOf("rez") > -1) {
      var rezzableNonIceCards = this._rezzableNonIceCards();
      //list of cards (by title) to rez EOT
      var cardsToRezEOT = [
        "Marilyn Campaign",
		"Nico Campaign",
        "PAD Campaign",
        "Clearinghouse",
		"Daily Business Show",
		"Corporate Town",
      ];
      for (var i = 0; i < cardsToRezEOT.length; i++) {
        var copyOfCard = this._copyOfCardExistsIn(
          cardsToRezEOT[i],
          rezzableNonIceCards
        );
        if (copyOfCard) {
          var wouldUse = true;
          if (typeof copyOfCard.AIWouldTrigger == "function") {
            if (!copyOfCard.AIWouldTrigger.call(copyOfCard))
              wouldUse = false;
          }
          if (wouldUse)
            return this._returnPreference(optionList, "rez", {
              cardToRez: copyOfCard,
            });
        }
      }
      //some cards we should use if we have another copy in hand instead of hogging a server
      var cardsToRezIfDuplicate = ["Spin Doctor"];
      for (var i = 0; i < cardsToRezIfDuplicate.length; i++) {
        var copyOfCard = this._copyOfCardExistsIn(
          cardsToRezIfDuplicate[i],
          rezzableNonIceCards
        );
        if (copyOfCard) {
          for (var j = 0; j < corp.HQ.cards.length; j++) {
            if (GetTitle(corp.HQ.cards[j]) == GetTitle(copyOfCard)) {
              this._log("Might as well use this");
              return this._returnPreference(optionList, "rez", {
                cardToRez: copyOfCard,
              });
            }
          }
        }
      }
    }

    //if trigger is an option, use it by default
    if (optionList.indexOf("trigger") > -1)
      return optionList.indexOf("trigger");

    return optionList.indexOf("n");
  }

  Phase_PostAction(optionList) {
    if (optionList.indexOf("rez") > -1) {
      var rezzableNonIceCards = this._rezzableNonIceCards();
      //list of cards (by title) to rez post-action
      var cardsToRezPostAction = ["SanSan City Grid"];
      if (this._clicksLeft() > 0)
        cardsToRezPostAction.push("Regolith Mining License", "Ronin", "Reversed Accounts");
      for (var i = 0; i < cardsToRezPostAction.length; i++) {
        var copyOfCard = this._copyOfCardExistsIn(
          cardsToRezPostAction[i],
          rezzableNonIceCards
        );
        if (copyOfCard)
          return this._returnPreference(optionList, "rez", {
            cardToRez: copyOfCard,
          });
      }
    }
    return optionList.indexOf("n");
  }

  Phase_DiscardResponse(optionList) {
	if (optionList.indexOf("trigger") > -1) {
		return optionList.indexOf("trigger");
	}
	return 0;
  }

  //sets this.preferred to prefs and returns indexOf cmd in optionList
  //don't forget to return the result!
  _returnPreference(optionList, cmd, prefs) {
    this.preferred = prefs;
    this.preferred.command = cmd;
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

  //this function is either reached because the trash is optional or called by _bestTrashOption
  Phase_TrashBeforeInstall(optionList) {
    this._log("phase is trash before install");
    //no need to check assets since they'll be automatically trashed
	
	//check for unrezzed ice with hosted card (e.g. Tranquilizer) unless super rich
	for (var i = 0; i < optionList.length; i++) {
	  if (typeof optionList[i].card !== "undefined") {
		var card = optionList[i].card;
		if (card !== null) {
		  if (!CheckCardType(card, ["ice"])) {
			if ( (typeof(card.hostedCards) !== 'undefined') && (card.hostedCards.length > 0) && (!card.rezzed) && (Credits(corp) < RezCost(card)*5) ) {
				this._log("trashing an ice card");
				return i;
			}
	      }
		}
	  }
	}

    //there may be no choice - check:
    if (optionList.indexOf("n") > -1) {
      this._log("not helpful to trash anything right now");
      return optionList.indexOf("n");
    }

    //no preferred card to trash? try to at least avoid trashing upgrades
    for (var i = 0; i < optionList.length; i++) {
      if (typeof optionList[i].card !== "undefined") {
        var card = optionList[i].card;
        if (card !== null) {
          if (!CheckCardType(card, ["upgrade"])) {
            this._log("trashing a non-upgrade card");
            return i;
          }
        }
      }
    }

    this._log("I have no choice, will trash an arbitrary card");
    return 0;
  }

  Phase_Score(optionList) {
    var cardToScore =
      phaseTemplates.corpScorableResponse.Enumerate.score()[0].card; //just use the first available score option (there's unlikely to be more than one)
	if (cardToScore.AIOverAdvance) {
		if (typeof cardToScore.AIAdvancementLimit == 'function') {
			var advLim = cardToScore.AIAdvancementLimit.call(cardToScore);
			if (cardToScore.advancement < advLim) return -1; //don't score yet
		}
	}
    var serverToScoreIn = GetServer(cardToScore);
    //are there things we could rez to benefit?
    if (optionList.indexOf("rez") > -1) {
      var rnics = this._rezzableNonIceCards();
      for (var i = 0; i < rnics.length; i++) {
        var card = rnics[i];
        if (typeof card.AIWouldRezBeforeScore !== "undefined") {
          if (
            card.AIWouldRezBeforeScore.call(card, cardToScore, serverToScoreIn)
          )
            return this._returnPreference(optionList, "rez", {
              cardToRez: card,
            });
        }
      }
    }
    //are there things we could install or play first to benefit?
    if (this._clicksLeft() > 0) {
      for (var i = 0; i < corp.HQ.cards.length; i++) {
        var card = corp.HQ.cards[i];
        if (typeof card.AIWouldRezBeforeScore !== "undefined") {
          if (
            card.AIWouldRezBeforeScore.call(card, cardToScore, serverToScoreIn)
          ) {
            if (CheckCredits(corp, RezCost(card), "rezzing", card)) {
              //only handling scoring upgrades at the moment (may need to add consideration of assets being put in a server other than this one)
              if (card.AIIsScoringUpgrade) {
                if (this._shouldUpgradeServerWithCard(serverToScoreIn, card))
                  return this._returnPreference(optionList, "install", {
                    serverToInstallTo: serverToScoreIn,
                    cardToInstall: card,
                  });
              }
            }
          }
        }
        if (typeof card.AIWouldPlayBeforeScore !== "undefined") {
          if (
            card.AIWouldPlayBeforeScore.call(card, cardToScore, serverToScoreIn)
          ) {
			//the true here means yes log, the first false means don't check AIWouldPlay, the second means don't require action phase
			if (this._commonCardToPlayChecks(card,"before score",true,false,false)) {
				return this._returnPreference(optionList, "play", {
					cardToPlay: card,
				});
			}
		  }
		}
      }
    }
    return this._returnPreference(optionList, "score", {
      cardToScore: cardToScore,
    });
  }

  //returns array of advanced cards as {card,advancement} ranked by most advancement first
  //takes input of min advancement and a card to exclude
  _advancedCards(min=1,exclude=null) {
	var installedCards = InstalledCards(corp);
	var ret = [];
	installedCards.forEach(function(item){
	  if (item != exclude) {
	    var adv = Counters(item, "advancement");
	    var obj = { card:item, advancement:adv };
	    if (adv >= min) {
		  var inserted = false;
		  //insert at correct position
		  for (var i=0; i<ret.length; i++) {
		    if (adv > ret[i].advancement) {
			  ret.splice(i, 0, obj);
			  inserted = true;
			  break;
		    }
		  }
		  //or just on end
		  if (!inserted) ret.push(obj);
	    }
	  }
	});
	return ret;
  }

  //directions function for potential operation damage search
  //returns an array of possible points from this point
  //damage cards currently considered: Neurospike, Punitive Counterstrike
  //and utility cards to increase damage: Archived Memories, Biotic Labor
  //non-operations are NOT currently considered here (for simplicity) e.g. Orbital Superiority, Ronin
  _potentialOperationDamageDirections(point) {
	  var ret = [];
	  var cardinhand = null; //for reuse
	  var indexinhand = -1; //for reuse
	  var newhandcards = []; //for reuse
	  var newarchivescards = []; //for reuse
	  //Neurospike
	  cardinhand = this._copyOfCardExistsIn("Neurospike",point.handCards);
	  if (point.corpCredits > 2 && point.corpClicks > 0) {
		  indexinhand = point.handCards.indexOf(cardinhand);
		  if (indexinhand > -1) {
			newhandcards = point.handCards.concat([]); //make a copy of the array
			newarchivescards = newarchivescards.concat(newhandcards.splice(indexinhand,1)); //move played card
			ret.push({
			  corpCredits: point.corpCredits - 3,
			  corpClicks: point.corpClicks - 1,
			  handCards: newhandcards,
			  archivesCards: newarchivescards,
			  damageSoFar: point.damageSoFar + cardinhand.printedAgendaPointsThisTurn,
			  using: cardinhand,
			  persist: point.persist,
			});
		  }
	  }
	  //Punitive Counterstrike
	  cardinhand = this._copyOfCardExistsIn("Punitive Counterstrike",point.handCards);
	  //include trace cost if we've got time (agenda points) to wait for another chance (assuming Runner won't score 4+ points in a turn)
	  var punitiveCost = 3;
	  if (AgendaPointsToWin() - AgendaPoints(runner) > 3) punitiveCost += Link() + Credits(runner) - 4; //the 4 assumes base strength 5
	  if (point.corpCredits >= punitiveCost && point.corpClicks > 0) {
		  indexinhand = point.handCards.indexOf(cardinhand);
		  if (indexinhand > -1) {
			newhandcards = point.handCards.concat([]); //make a copy of the array
			newarchivescards = newarchivescards.concat(newhandcards.splice(indexinhand,1)); //move played card
			ret.push({
			  corpCredits: point.corpCredits - punitiveCost,
			  corpClicks: point.corpClicks - 1,
			  handCards: newhandcards,
			  archivesCards: newarchivescards,
			  damageSoFar: point.damageSoFar + cardinhand.printedAgendaPointsLastTurn,
			  using: cardinhand,
			  persist: point.persist,
			});
		  }
	  }
	  //Biotic Labor
	  if (point.corpCredits > 3 && point.corpClicks > 0) {
		  cardinhand = this._copyOfCardExistsIn("Biotic Labor",point.handCards);
		  indexinhand = point.handCards.indexOf(cardinhand);
		  if (indexinhand > -1) {
			newhandcards = point.handCards.concat([]); //make a copy of the array
			newarchivescards = newarchivescards.concat(newhandcards.splice(indexinhand,1)); //move played card
			ret.push({
			  corpCredits: point.corpCredits - 4,
			  corpClicks: point.corpClicks + 1,
			  handCards: newhandcards,
			  archivesCards: newarchivescards,
			  damageSoFar: point.damageSoFar, //biotic doesn't damage
			  using: cardinhand,
			  persist: point.persist,
			});
		  }
	  }
	  //Archived Memories (note the extra click needed to play the recurred card)
	  if (point.corpClicks > 1) {
		  cardinhand = this._copyOfCardExistsIn("Archived Memories",point.handCards);
		  indexinhand = point.handCards.indexOf(cardinhand);
		  if (indexinhand > -1) {
			var cardsToRecur = ["Neurospike","Punitive Counterstrike","Biotic Labor"];
			for (var i=0; i<cardsToRecur.length; i++) {
			    var cardinarchives = this._copyOfCardExistsIn(cardsToRecur[i],point.archivesCards);
			    var indexinarchives = point.archivesCards.indexOf(cardinarchives);
				if (indexinarchives > -1) {
					newarchivescards = point.archivesCards.concat([]); //make a copy of the array
					newhandcards = point.handCards.concat([]); //make a copy of the array
					newarchivescards = newarchivescards.concat(newhandcards.splice(indexinhand,1)); //move archived memories (to back so it doesn't change indexinarchives)
					newhandcards = newhandcards.concat(newarchivescards.splice(indexinarchives,1)); //move recurred card
					ret.push({
					  corpCredits: point.corpCredits,
					  corpClicks: point.corpClicks - 1,
					  handCards: newhandcards,
					  archivesCards: newarchivescards,
					  damageSoFar: point.damageSoFar, //archived doesn't damage
					  using: cardinhand,
					  persist: point.persist,
					});
				}
			}
		  }
	  }
	  return ret;
  }

  //returns int
  //if an output array is specified, the cards will be written to it in the order decided here
  //see notes on directions for cards currently considered
  _potentialOperationDamageThisTurn(output=[]) {
	  var availableCredits = Credits(corp);
	  var clicksLeft = this._clicksLeft();
	  //make copies of the source arrays (to prevent accidentally modifying them)
	  var handCards = corp.HQ.cards.concat([]);
	  var archivesCards = corp.archives.cards.concat([]);
	  //start with damage from resolving cards
	  var startingDamage = 0;
	  for (var i=0; i<corp.resolvingCards.length; i++) {
		  if (corp.resolvingCards[i].title == "Neurospike") startingDamage += corp.resolvingCards[i].printedAgendaPointsThisTurn;
		  else if (corp.resolvingCards[i].title == "Punitive Counterstrike") startingDamage += corp.resolvingCards[i].printedAgendaPointsLastTurn;
	  }
	  var startingPoint = {
		  corpCredits: availableCredits,
		  corpClicks: clicksLeft,
		  handCards: handCards,
		  archivesCards: archivesCards,
		  damageSoFar: startingDamage,
		  persist: [],
	  };
	  //generate starting directions as todo
	  var startingDirections = this._potentialOperationDamageDirections(startingPoint);
	  var todo = [];
	  for (var i=0; i<startingDirections.length; i++) {
		  todo.push([startingDirections[i]]);
	  }
	  //recurse, keeping track of best path
	  var bestpath = [];
	  var loops = 0;
	  var maxLoops = 100000; //arbitrary to prevent unplanned infinite loops
	  while (todo.length > 0 && loops < maxLoops) {
		loops++;
		var thispath = todo.shift();
		var directions = this._potentialOperationDamageDirections(thispath[thispath.length-1]);
		if (directions.length > 0) {
			directions.forEach(function(item) {
				todo.push(thispath.concat([item]));
			});
		}
		else {
			//this path done, check/update bestpath
			//priorities are:
			//most damage
			//most cards remaining
			//most clicks/credits remaining
			var clickValueScale = 2.0; //arbitrary
			var better = false;
			if (bestpath.length < 1) better = true;
			else {
				var bestendpoint = bestpath[bestpath.length - 1];
				var thisendpoint = thispath[thispath.length - 1];
				if (thisendpoint.damageSoFar > bestendpoint.damageSoFar) better = true;
				else if (thisendpoint.damageSoFar == bestendpoint.damageSoFar)  {
					if (thisendpoint.handCards.length > bestendpoint.handCards.length) better = true;
					else if (thisendpoint.handCards.length == bestendpoint.handCards.length) {
						if (clickValueScale*thisendpoint.corpClicks + thisendpoint.corpCredits > clickValueScale*bestendpoint.corpClicks + bestendpoint.corpCredits) better = true;
					}
				}
			}
			if (better) bestpath = thispath;
			//special debug code, print path and indicate whether it is best
			var outstr = "[";
			for (var i=0; i<thispath.length; i++) {
				outstr += thispath[i].using.title.charAt(0);
			}
			/*
			if (debugging) {
				outstr += "](";
				outstr += "da:"+thispath[thispath.length-1].damageSoFar;
				outstr += ",ca:"+thispath[thispath.length-1].handCards.length;
				outstr += ",cl&cr:"+(clickValueScale*thispath[thispath.length-1].corpClicks+thispath[thispath.length-1].corpCredits);
				outstr += ",cl:"+thispath[thispath.length-1].corpClicks;
				outstr += ")";
				if (better) outstr += "**";
				this._log(outstr);
			}
			*/
		}
	  }
	  if (loops == maxLoops) console.log("Damage search exceeded loop limit");
	  //all paths found, return best
	  var ret = 0;
	  if (bestpath.length > 0) ret = bestpath[bestpath.length - 1].damageSoFar;
	  for (var i=0; i<bestpath.length; i++) {
		  output.push(bestpath[i].using);
	  }
	  return ret;
  }

  //directions function for potential advancement search
  //returns an array of possible points from this point
  //options can include:
  //.card (null by default) the card being advanced
  //.thisTurn (true by default) if false, clicks are not the limiting factor
  //.limit (Infinity by default) note this is total limit including counters that were already present
  _potentialAdvancementDirections(point,options=null) {
	  var ret = [];
	  //load options
	  var card = null;
	  var thisTurn = true;
	  var limit = Infinity;
	  if (options) {
		  if (typeof options.thisTurn != 'undefined') thisTurn = options.thisTurn;
		  if (typeof options.limit != 'undefined') limit = options.limit;
		  if (typeof options.card != 'undefined') card = options.card;
	  }
	  //destination reached
	  if (point.advancementSoFar >= limit) return ret;
	  //basic advance
	  if (point.corpCredits > 0 && point.corpClicks > 0) {
		  //pay the credit
		  var newCredits = point.corpCredits - 1;
		  //special case: Built to Last
		  if (point.advancementSoFar < 1 && corp.identityCard.title == "Weyland Consortium: Built to Last") newCredits += 2
		  //special case: Oaktown Renovation
		  if (card) {
			  if (card.title == "Oaktown Renovation") {
				if (point.advancementSoFar < 4) newCredits += 2;
				else newCredits += 3;
			  }
		  }
		  var basicadvcards = point.handCards.concat([]); //make a copy of the array
		  ret.push({
			  corpCredits: newCredits,
			  corpClicks: point.corpClicks - 1,
			  handCards: basicadvcards,
			  advancementSoFar: point.advancementSoFar + 1,
			  using: null, //not using a card
			  persist: point.persist,
		  });
	  }
	  //other actions e.g. placing advancement counters, gaining clicks...
	  //Seamless Launch
	  if (card && point.corpCredits > 0 && point.corpClicks > 0) {
		  var slih = this._copyOfCardExistsIn("Seamless Launch",point.handCards);
		  if (slih) {
			  if (!thisTurn || !slih.cardsInstalledThisTurn.includes(card)) {
				  var slidx = point.handCards.indexOf(slih);
				  if (slidx > -1) {
					var slcards = point.handCards.concat([]); //make a copy of the array
					slcards.splice(slidx,1); //remove played card
					ret.push({
					  corpCredits: point.corpCredits - 1,
					  corpClicks: point.corpClicks - 1,
					  handCards: slcards,
					  advancementSoFar: point.advancementSoFar + 2,
					  using: slih,
					  persist: point.persist,
					});
				  }
			  }
		  }
	  }
	  //Psychographics
	  //already resolving
	  var pgres = this._copyOfCardExistsIn("Psychographics",corp.resolvingCards);
	  //still require it to be in the specified list
	  var pgridx = point.handCards.indexOf(pgres);
	  if (pgridx > -1) {
		var pgrcards = point.handCards.concat([]); //make a copy of the array
		pgrcards.splice(pgridx,1); //remove played card
		ret.push({
		  corpCredits: point.corpCredits,
		  corpClicks: point.corpClicks,
		  handCards: pgrcards,
		  advancementSoFar: point.advancementSoFar + pgres.AIPlayedWithCost,
		  using: pgres,
		  persist: point.persist,
		});
	  }
	  //still in hand
	  var pgih = this._copyOfCardExistsIn("Psychographics",point.handCards);
	  if (point.corpCredits > 1 && point.corpClicks > 0) {
		  var pgidx = point.handCards.indexOf(pgih);
		  if (pgidx > -1) {
			var maxX = Math.min(point.corpCredits, runner.tags);
			if (maxX + point.advancementSoFar > limit) maxX = limit - point.advancementSoFar;
			var pgcred = point.corpCredits - maxX;
			var pgclick = point.corpClicks - 1;
			var pgcards = point.handCards.concat([]); //make a copy of the array
			pgcards.splice(pgidx,1); //remove played card
			ret.push({
			  corpCredits: pgcred,
			  corpClicks: pgclick,
			  handCards: pgcards,
			  advancementSoFar: point.advancementSoFar + maxX,
			  using: pgih,
			  persist: point.persist,
			});
		  }
	  }
	  //Trick of Light
	  if (point.corpCredits > 0 && point.corpClicks > 0) {
		  var tlih = this._copyOfCardExistsIn("Trick of Light",point.handCards);
		  var tlidx = point.handCards.indexOf(tlih);
		  if (tlidx > -1) {
			  //take into account previously played sources (reduce counter availability on sources)
			  var advCards = this._advancedCards(2,card); //takes input of minimum advancement and one card to exclude
			  var tolSource = null;
			  for (var i=0; i<advCards.length; i++) {
				var advRemaining = Counters(advCards[i].card, "advancement");
				point.persist.forEach(function(item) {
					//assume ToL would only be used to take 2 counters
					if (typeof item.trickOfLightSource != 'undefined') {
						if (item.trickOfLightSource == advCards[i].card) advRemaining -= 2
					}
				});
				if (advRemaining > 1) {
					tolSource = advCards[i].card;
					break;
				}
			  }
			  //action this tol
			  if (tolSource) {
				var tlcards = point.handCards.concat([]); //make a copy of the array
				tlcards.splice(tlidx,1); //remove played card
				ret.push({
				  corpCredits: point.corpCredits - 1,
				  corpClicks: point.corpClicks - 1,
				  handCards: tlcards,
				  advancementSoFar: point.advancementSoFar + 2, //assume ToL moves exactly 2 counters 
				  using: tlih,
				  persist: point.persist.concat([{trickOfLightSource:tolSource}]),
				});
			  }
		  }
	  }
	  //Biotic Labor
	  if (point.corpCredits > 3 && point.corpClicks > 0) {
		  var blih = this._copyOfCardExistsIn("Biotic Labor",point.handCards);
		  var blidx = point.handCards.indexOf(blih);
		  if (blidx > -1) {
			var blcards = point.handCards.concat([]); //make a copy of the array
			blcards.splice(blidx,1); //remove played card
			ret.push({
			  corpCredits: point.corpCredits - 4,
			  corpClicks: point.corpClicks + 1,
			  handCards: blcards,
			  advancementSoFar: point.advancementSoFar, //biotic doesn't directly advance
			  using: blih,
			  persist: point.persist,
			});
		  }
	  }
	  return ret;
  }

  //for potential advancement search, each point has:
  //corpCredits, credits left in corp credit pool
  //corpClicks, clicks left in corp click tracker
  //handCards, cards left to use (if a card was played along this path, it has been removed)
  //advancementSoFar, advancement counters on card being advanced
  //using, card that was used to place counters this point (null for basic action)
  //persist, array of persistent effects

  //if null card is specified, this is a generic "what if one was to be installed?" check
  //(in which case it will assume a click less) unless assumeClicks (int) is specified (but assumeClicks will be ignored if thisTurn=false)
  //if an output array is specified, the cards will be written to it in the order decided here (except for cards already resolving)
  _potentialAdvancement(card,limit,thisTurn=true,fastAdvanceArray,assumeClicks,output=[]) {
	  if (typeof fastAdvanceArray == 'undefined') fastAdvanceArray = corp.resolvingCards.concat(corp.HQ.cards); //source of fast advance cards
	  var availableCredits = Credits(corp);
	  var advancementSoFar = 0;
	  if (card) advancementSoFar = Counters(card, "advancement");
	  var startingAdvancement = advancementSoFar; //this function returns change to advancement not total
	  var options = {
		  card: card,
		  thisTurn: thisTurn,
		  limit: limit,
	  };
	  //this point is not stored, just used as a base for initial directions
	  var clicksLeft = 20; //essentially infinity but allows for subtraction/addition
	  if (thisTurn) {
		  var clicksLeft = this._clicksLeft();
		  if (!card) clicksLeft--;
		  if (typeof assumeClicks != 'undefined') clicksLeft=assumeClicks;
	  }
	  var startingPoint = {
		  corpCredits: availableCredits,
		  corpClicks: clicksLeft,
		  handCards: fastAdvanceArray,
		  advancementSoFar: advancementSoFar,
		  persist: [],
	  };
	  //generate starting directions as todo
	  var startingDirections = this._potentialAdvancementDirections(startingPoint, options);
	  var todo = [];
	  for (var i=0; i<startingDirections.length; i++) {
		  todo.push([startingDirections[i]]);
	  }
	  //recurse, keeping track of best path
	  var bestpath = [];
	  var loops = 0;
	  var maxLoops = 200000; //arbitrary to prevent unplanned infinite loops
	  while (todo.length > 0 && loops < maxLoops) {
		loops++;
		var thispath = todo.shift();
		var directions = this._potentialAdvancementDirections(thispath[thispath.length-1], options);
		if (directions.length > 0) {
			directions.forEach(function(item) {
				todo.push(thispath.concat([item]));
			});
		}
		else {
			//this path done, check/update bestpath
			//priorities are:
			//most advancement (up to limit)
			//most cards remaining
			//most clicks/credits remaining
			var clickValueScale = 2.0; //arbitrary
			var better = false;
			if (bestpath.length < 1) better = true;
			else {
				var bestendpoint = bestpath[bestpath.length - 1];
				var thisendpoint = thispath[thispath.length - 1];
				if (thisendpoint.advancementSoFar > bestendpoint.advancementSoFar && bestendpoint.advancementSoFar < limit) better = true;
				else if (thisendpoint.advancementSoFar >= bestendpoint.advancementSoFar || thisendpoint.advancementSoFar >= limit)  {
					if (thisendpoint.handCards.length > bestendpoint.handCards.length) better = true;
					else if (thisendpoint.handCards.length == bestendpoint.handCards.length) {
						if (clickValueScale*thisendpoint.corpClicks + thisendpoint.corpCredits > clickValueScale*bestendpoint.corpClicks + bestendpoint.corpCredits) better = true;
					}
				}
			}
			if (better) bestpath = thispath;
			//special debug code, print path and indicate whether it is best
			var outstr = "[";
			for (var i=0; i<thispath.length; i++) {
				if (thispath[i].using) outstr += thispath[i].using.title.charAt(0);
				else outstr += "a";
			}
			/*
			if (debugging) {
				outstr += "](";
				outstr += "ad:"+thispath[thispath.length-1].advancementSoFar+"/"+limit;
				outstr += ",ca:"+thispath[thispath.length-1].handCards.length;
				outstr += ",cl&cr:"+(clickValueScale*thispath[thispath.length-1].corpClicks+thispath[thispath.length-1].corpCredits);
				outstr += ",cl:"+thispath[thispath.length-1].corpClicks;
				outstr += ")";
				if (better) outstr += "**";
				this._log(outstr);
			}
			*/
		}
	  }
	  if (loops == maxLoops) console.log("Advancement search exceeded loop limit");
	  //all paths found, return best
	  var ret = 0;
	  if (bestpath.length > 0) ret = bestpath[bestpath.length - 1].advancementSoFar - startingAdvancement;
	  for (var i=0; i<bestpath.length; i++) {
		  output.push(bestpath[i].using);
	  }
	  return ret;
  }

  //check if a card should be fast advanced (true or false)
  _cardShouldBeFastAdvanced(card) {
	  if (this._isFullyAdvanceableAgenda(card)) return true;
	  else if (typeof card.AIRushToFinish == 'function') {
		if (card.AIRushToFinish.call(card)) return true;
	  }
	  return false;
  }
    
  _isFullyAdvanceableHostileAsset(card,fastAdvanceArray) { //can be finished and used this turn
    if (typeof fastAdvanceArray == 'undefined') fastAdvanceArray = corp.HQ.cards.concat(corp.resolvingCards); //source of fast advance cards
	if (!CheckCardType(card, ["asset"]) || !CheckSubType(card,"Hostile")) return false;
	if (typeof card.AIRushToFinish == 'function') {
		if (card.AIRushToFinish.call(card)) {
			return this._potentialAdvancement(card,Infinity,true,fastAdvanceArray) >= this._advancementStillRequired(card);
		}
	}
	return false;
  }

  _isFullyAdvanceableAgenda(card,fastAdvanceArray) { //can be finished and scored this turn
    if (typeof fastAdvanceArray == 'undefined') fastAdvanceArray = corp.HQ.cards.concat(corp.resolvingCards); //source of fast advance cards
	if (!CheckCardType(card, ["agenda"])) return false;
	if (!CheckScore(card,true)) return false; //the true means ignore advancement requirement
	var canFullyAdvance = this._potentialAdvancement(card,Infinity,true,fastAdvanceArray) >= this._advancementStillRequired(card);
	return canFullyAdvance;
  }
  
  _fullyAdvanceableAgendaInstalled(fastAdvanceArray) {
	var installedCards = InstalledCards(corp);
	for (var i=0; i<installedCards.length; i++) {
		if (this._isFullyAdvanceableAgenda(installedCards[i],fastAdvanceArray)) return true;
	}
	return false;	  
  }

  //returns true if the card should be played
  //TODO use functions like this more widely rather than having copies of similar code
  _commonCardToPlayChecks(cardToPlay,msg="",logwillplay=false,checkWouldPlay=true,requireActionPhase=true) {
	if (cardToPlay) {
	  this._log("there is a card to play "+msg);
	  var playThis = true; //if no specific rules have been defined then just play it whenever you can
	  if (checkWouldPlay && typeof(cardToPlay.AIWouldPlay) == 'function') playThis = cardToPlay.AIWouldPlay.call(cardToPlay);
	  if (playThis&&FullCheckPlay(cardToPlay,requireActionPhase)) {
		if (logwillplay) this._log("I will play it");
		return true;
	  }
	}
	return false;
  }

  //return a card we can use to benefit from tags (useWhenTaggedCards is in order of preference)
  //or null if none
  _useWhenTaggedCard() {
	  var useWhenTaggedCards = ["Retribution", "Predictive Planogram"];
	  for (var i = 0; i < useWhenTaggedCards.length; i++) {
		var cardToPlay = this._copyOfCardExistsIn(
		  useWhenTaggedCards[i],
		  corp.HQ.cards
		);
		if (this._commonCardToPlayChecks(cardToPlay,"that benefits from tags")) {
			return cardToPlay;
		}
	  }
	  return null;
  }
  
  //if tags were to be given to the Runner, could they be punished for it (hypothetically)
  //returns true or false
  //given the hypothetical tags, corp clicks, and corp credits
  _potentialTagPunishment(tags,clicks,credits) {
	  if (clicks > 0 && credits > 1 && runner.rig.resources.length > 0) return true; //could trash a resource using the main phase action
	  //set up for hypothetical testing
	  var storedTags = runner.tags;
	  var storedClicks = corp.clickTracker;
	  var storedCredits = corp.creditPool;
	  var storedPhaseIdentifier = currentPhase.identifier;
	  //set hypotheticals
	  runner.tags = tags;
	  corp.clickTracker = clicks;
	  corp.creditPool = credits;
	  currentPhase.identifier = "Corp 2.2"; //for CheckActionClicks
	  var useWhenTaggedCard = this._useWhenTaggedCard();
	  //restore actual values
	  runner.tags = storedTags;
	  corp.creditPool = storedCredits;
	  corp.clickTracker = storedClicks;
	  currentPhase.identifier == storedPhaseIdentifier;
	  if (useWhenTaggedCard) return true;
	  return false;
  }

  Phase_Main(optionList) {
    //for debugging, list server protection including archives
	this._serverToProtect(false,true);

	var cardToPlay = null; //used for checks

	var sufficientEconomy = this._sufficientEconomy();

	//check for cards to rez (folded in from 2.1, probably)
	if (optionList.includes("rez")) {
	  var paRet = this.Phase_PostAction(optionList);
	  if (paRet != optionList.indexOf("n")) return paRet;
	}

	//check for priority triggers
	if (optionList.includes("trigger")) {
	  var triggerables = ChoicesTriggerableAbilities(corp);
	  for (var i = 0; i < triggerables.length; i++) {
		if (triggerables[i].card.AITriggerWhenCan) {
		  this._log("there is an active card I would use ability of");
		  return this._returnPreference(optionList, "trigger", {
			cardToTrigger: triggerables[i].card,
		  });
		}
	  }
	}
	
	//check for kill combos
	if (optionList.includes("play")) {
		var damageOps = [];
		var opDamageThisTurn = this._potentialOperationDamageThisTurn(damageOps);
		this._log("I could do "+opDamageThisTurn+" damage with these cards: "+JSON.stringify(damageOps));
		if (opDamageThisTurn > runner.grip.length && damageOps.length > 0) {
			cardToPlay = damageOps[0];
			if (this._commonCardToPlayChecks(cardToPlay,"for kill combo",true)) {
				return this._returnPreference(optionList, "play", {
				  cardToPlay: cardToPlay,
				});
			}
		}
	}

	//check for an almost-done agenda/hostile asset, if so prioritise it for advancing
	var almostDoneAgenda = null;
	var almostDoneServer = null;
	var almostDoneHostileAsset = null;
	if (optionList.indexOf("advance") > -1) {
		//agendas first
		for (var i = 0; i < corp.remoteServers.length; i++) {
			for (var j = 0; j < corp.remoteServers[i].root.length; j++) {
			  if (CheckAdvance(corp.remoteServers[i].root[j]) && this._isFullyAdvanceableAgenda(corp.remoteServers[i].root[j])) {
				  if (almostDoneAgenda) {
					  //assume the one with the higher printed advancement requirement or agendaPoints is better
					  if ( ( this._advancementLimit(corp.remoteServers[i].root[j], corp.remoteServers[i]) > this._advancementLimit(almostDoneAgenda, almostDoneServer) ) ||
					    (corp.remoteServers[i].root[j].agendaPoints > almostDoneAgenda.agendaPoints)) {
					    almostDoneAgenda = corp.remoteServers[i].root[j];
						almostDoneServer = corp.remoteServers[i];
					    this._log("This would be even better");
					  }
				  }
				  else {
					  almostDoneAgenda = corp.remoteServers[i].root[j];
					  almostDoneServer = corp.remoteServers[i];
					  this._log("I could get an agenda done this turn");
				  }
			  }
			}
		}

		//then hostile assets
		for (var i = 0; i < corp.remoteServers.length; i++) {
			for (var j = 0; j < corp.remoteServers[i].root.length; j++) {
			  if (CheckAdvance(corp.remoteServers[i].root[j]) && this._isFullyAdvanceableHostileAsset(corp.remoteServers[i].root[j])) {
				  //for now we'll just choose the first one found
				  almostDoneHostileAsset = corp.remoteServers[i].root[j];
				  this._log("I could get a hostile done this turn");
			  }
			}
		}		
	}
	if (!almostDoneAgenda && !almostDoneHostileAsset) {
		//take advantage of a temporary window of opportunity (i.e., play right away)
		if (optionList.includes("play")) {
		  //these are in order of priority, most critical first
		  var useWhenCanCards = [
		    "Punitive Counterstrike", //agendas stolen
			"Neurospike", //agendas scored
			"Public Trail", //successful run
			"Archived Memories", //desired target to recur
		  ];
		  for (var i = 0; i < useWhenCanCards.length; i++) {
			cardToPlay = this._copyOfCardExistsIn(
			  useWhenCanCards[i],
			  corp.HQ.cards
			);
			if (this._commonCardToPlayChecks(cardToPlay,"if opportunity arises",true)) {
				return this._returnPreference(optionList, "play", {
				  cardToPlay: cardToPlay,
				});
			}
		  }
		}

		//should I take advantage of the runner being tagged?
		if (CheckTags(1)) {
		  //first check if there are cards we can use to benefit from tags
		  if (optionList.includes("play")) {
			  cardToPlay = this._useWhenTaggedCard();
			  if (cardToPlay) {
				return this._returnPreference(optionList, "play", {
				  cardToPlay: cardToPlay,
				});
			  }
		  }
		  //or we can just use the basic action
		  if (optionList.indexOf("trash") > -1) return optionList.indexOf("trash");
		}

		//would it be worth purging?
		if (optionList.indexOf("purge") > -1) {
		  //this logic is very basic for now...
		  //each card with virus counters over 2 has a chance of provoking a purge
		  var virus_max = 10; //the higher this number, the less chance of a purge
		  var virus_min = 2;
		  var installedRunnerCards = InstalledCards(runner);
		  if (this._copyOfCardExistsIn("Clot",installedRunnerCards)) {
			  //if a Clot is in play, increased chance to purge
			  virus_min-=2;
		  }
		  for (var i = 0; i < installedRunnerCards.length; i++) {
			var randomNum = RandomRange(virus_min, virus_max);
			if (
			  Counters(installedRunnerCards[i], "virus") >
			  randomNum
			)
			  return optionList.indexOf("purge");
		  }
		}
	}

    //is there something I could advance?
    if ( (almostDoneAgenda || almostDoneHostileAsset || sufficientEconomy) && optionList.indexOf("advance") > -1) {		
      //agendas and assets
      for (var i = 0; i < corp.remoteServers.length; i++) {
        for (var j = 0; j < corp.remoteServers[i].root.length; j++) {
		  var card = corp.remoteServers[i].root[j];
		  //check for priority
		  if (almostDoneAgenda && card !== almostDoneAgenda) continue;
          //something advanceable that's worth it
          if (
            CheckAdvance(card) &&
            !this._obsoleteBluff(card)
          ) {
            var advancementLimit = this._advancementLimit(card);
			//if the card is an ambush, check for higher-advance to bluff as
			if (CheckSubType(card,"Ambush")) {
				var blufflim = this._bluffAdvanceLimit(card);
				if (blufflim > advancementLimit) advancementLimit = blufflim;
			}
			//check if agenda is well-protected or HQ is weak (in which case we need to start moving agendas into servers)
			var thisRemoteProtectionScore = this._protectionScore(corp.remoteServers[i], {});
			//the 0.5 is arbitrary but hopefully works as a simple guess of how likely the Runner is to be able to attack it next turn
			var shouldStartAdvancingAgenda = thisRemoteProtectionScore > 0.5 * Credits(runner)
				|| thisRemoteProtectionScore > this._protectionScore(corp.HQ, {returnArchivesLowerScoreForHQIfBackdoor:true});
			//don't start advancing if too poor to finish the job (the false means not necessarily this turn) or agenda in weak server
			var startOrContinueAdvancement = false;
			if (card.advancement > 0) startOrContinueAdvancement = true; //already started, feel free to continue (the counter shows the runner it is advanceable)
			else if (!CheckCardType(card, ["agenda"]) || card == almostDoneAgenda || shouldStartAdvancingAgenda) {
				if (this._potentialAdvancement(card,Infinity,false) >= advancementLimit) startOrContinueAdvancement = true;
			}
			if ( startOrContinueAdvancement ) {
				if (
				  typeof card.advancement ===
					"undefined" ||
				  card.advancement < advancementLimit ||
				  card.AIOverAdvance
				) {
				  //if there is an economy or fast advance card in hand, consider using it
				  var potentialAdvCards = [];
				  var potentialAdvancement = this._potentialAdvancement(card,advancementLimit,true,corp.HQ.cards,corp.clickTracker,potentialAdvCards); 
				  this._log("I could advance a card by "+potentialAdvancement+" with these cards: "+JSON.stringify(potentialAdvCards));
				  if (potentialAdvCards.length > 0 && potentialAdvCards[0]) {
					  //don't waste these by overadvancing an ordinary advancement target
					  if (Counters(card,"advancement") < advancementLimit - 1 ||
						card.AIOverAdvance) {
						cardToPlay = potentialAdvCards[0];
					  }
					  //or an expensive fast advance (if needed or punishment combo exists)
					  if (!cardToPlay) {
						var advancementRemaining = this._advancementStillRequired(card);
						var spareCredAfterExpensiveAdv = Credits(corp) - (4 + advancementRemaining); //4 here is Biotic Labor (only expensive fast advance currently implemented)
						//first check can even afford it
						if (spareCredAfterExpensiveAdv >= 0) {
							var worthExpensiveFastAdvance = (advancementRemaining > corp.clickTracker);
							if (!worthExpensiveFastAdvance) {
								//might be wasteful, check for combos
								var arrayToCheckForCombo = corp.HQ.cards;
								//combos that require setup prior to score:
								var copyOfPublicTrail = this._copyOfCardExistsIn("Public Trail",arrayToCheckForCombo);
								if (spareCredAfterExpensiveAdv >= 4 && card.title == "Orbital Superiority" && copyOfPublicTrail && copyOfPublicTrail.successfulRunLastTurn) worthExpensiveFastAdvance=true;
								//and after score:
								//when an agenda is scored as Precision Design, take into account recur 1 card from archives
								if (corp.identityCard.title == "Haas-Bioroid: Precision Design") arrayToCheckForCombo = arrayToCheckForCombo.concat(corp.archives.cards);
								//when the agenda scored is Offworld Office, extra money exists
								if (card.title == "Offworld Office" || card.title == "Hostile Takeover") spareCredAfterExpensiveAdv += 7;
								//now check
								if (spareCredAfterExpensiveAdv >= 3 && this._copyOfCardExistsIn("Neurospike",arrayToCheckForCombo)) worthExpensiveFastAdvance=true;
								if (card.title == "Tomorrow's Headline" && this._potentialTagPunishment(runner.tags+1,1,spareCredAfterExpensiveAdv)) worthExpensiveFastAdvance=true;
							}
							if (worthExpensiveFastAdvance) {
							  cardToPlay = this._copyOfCardExistsIn(
								"Biotic Labor",
								corp.HQ.cards
							  );
							}
						}
					  }
					  var rushToFinish = false;
					  if (typeof card.AIRushToFinish == 'function') {
						rushToFinish = card.AIRushToFinish.call(card);
					  }
					  if ( cardToPlay && (card == almostDoneAgenda) || rushToFinish ) { //for now let's just use economy advance for finishing agendas or specific cards
						this._log("there is a card that will help advance");
						if (FullCheckPlay(cardToPlay) && optionList.includes("play")) {
							this._log("I intend to play it");
							cardToPlay.AIPreferredTarget = almostDoneAgenda;
							return this._returnPreference(optionList, "play", {
							  cardToPlay: cardToPlay,
							});
						}
					  }
				  }
				  return this._returnPreference(optionList, "advance", {
					cardToAdvance: card,
				  });
				}
			}
          }
        }
      }
      //advanceable ice
      var installedCards = InstalledCards(corp);
      for (var i = 0; i < installedCards.length; i++) {
        if (installedCards[i].canBeAdvanced) {
		  //not if it has been disabled
		  if (this._iceIsDisabled(installedCards[i])) continue;
		  //ok let's check some more things
          if (CheckCardType(installedCards[i], ["ice"])) {
            var advancementLimit = 5; //arbitrary
            if (typeof installedCards[i].AIAdvancementLimit == "function")
              advancementLimit = installedCards[i].AIAdvancementLimit.call(installedCards[i]);
		    if (advancementLimit > 0) {
				if (
				  typeof installedCards[i].advancement === "undefined" ||
				  installedCards[i].advancement < advancementLimit ||
				  installedCards[i].advancement.AIOverAdvance
				) {
				  this._log("I intend to advance ice");
				  return this._returnPreference(optionList, "advance", {
					cardToAdvance: installedCards[i],
				  });
				}
			}
          }
        }
      }
    }
    this._log("Nothing to advance"+(sufficientEconomy?"":" (can't afford it)"));

	if (optionList.indexOf("install") != -1) {
		var priorityRankedInstallOptions = this._rankedInstallOptions(corp.HQ.cards,true); //the true includes priority options only (e.g. exclude ice you can't afford or non-ice unprotected)
		if (priorityRankedInstallOptions.length > 0) return this._returnPreference(optionList, "install", priorityRankedInstallOptions[0]);
	}
    this._log("No obvious install options");

    //how bad is the economy? it may be necessary even to click for credits
    if (!this._sufficientEconomy()) {
      this._log("I am feeling poor");
      return this._bestMainPhaseEconomyOption(optionList);
    }
	
    //even with some wealth, prioritise economy (unless we are super rich, hence the false for 'tight')
    if (!this._sufficientEconomy(false)) {
      var bestEconomyOption = this._bestMainPhaseEconomyOption(optionList);
      if (bestEconomyOption != optionList.indexOf("gain"))
        return bestEconomyOption; //i.e. don't click for creds!
    }
    this._log("No obvious economy option");

    //how much empty space in hand?
    var handSpace = MaxHandSize(corp) - PlayerHand(corp).length;

    //should I play or install something?
    if (handSpace < 0 || (handSpace == 0 && this._clicksLeft() > 1)) {
      //even if there are cards in hand doesn't mean we can play any of them
      if (optionList.indexOf("install") != -1) {
		var rankedInstallOptions = this._rankedInstallOptions(corp.HQ.cards);
		//check if options would be expanded by slightly more credits
		if (optionList.indexOf("gain") > -1) {
			corp.creditPool += this._clicksLeft() - 1; //temporary (hypothetical)
			var optionsExpanded = rankedInstallOptions < this._rankedInstallOptions(corp.HQ.cards);
			corp.creditPool -= this._clicksLeft() - 1; //roll back the change
			if (optionsExpanded) {
				this._log("Just need a tiny bit more cash");
				return optionList.indexOf("gain");
			}
		}
        if (rankedInstallOptions.length > 0) {
          this._log("Oh I know, I'll install something");
          //if the best option is to install non-ice into an unprotected server, don't do it unless we can install ice next click
          if (
            rankedInstallOptions[0].cardToInstall.cardType == "ice" ||
            this._protectionScore(rankedInstallOptions[0].serverToInstallTo, {}) >
              1 ||
            (this._clicksLeft() > 2 &&
              this._affordableIce(rankedInstallOptions[0].serverToInstallTo, {}))
          )
            return optionList.indexOf("install");
        }
      }
	  /*
      if (optionList.indexOf("play") != -1) {
        //at the moment this is just a play it without thinking...but might not be best
        return optionList.indexOf("play");
      }
	  */
    }

    //not sure what to do, so just get rich
	this._log("Not sure what to do");
    return this._bestMainPhaseEconomyOption(optionList);
  }

  //***CLASS DEFINITION AND CORE AI CODE***
  constructor() {
    this.preferred = null;
  }

  //returns index of choice
  Choice(optionList, choiceType) {
    if (optionList.length < 1) {
      LogError("No valid commands available");
      return;
    }
    //check for preferreds
    var ret = -1;
    if (this.preferred !== null) {
      //special: specific option in specific phase
      if (typeof this.preferred.title !== "undefined") {
        if (this.preferred.title == currentPhase.title) {
          ret = optionList.indexOf(this.preferred.option);
          if (ret > -1) {
            this.preferred = null; //reset (don't reuse the preference)
            return ret;
          }
        }
      }

      //return the optionList index of the preferred option, if found
      //NOTE this will clear preferred, if a relevant preference is found
      if (typeof this.preferred.command !== "undefined") {
        var cmd = this.preferred.command;
        if (executingCommand == cmd) {
          var data = [];
          if (cmd == "trash") data = [{ prop: "card", key: "cardToTrash" }];
          else if (cmd == "rez") data = [{ prop: "card", key: "cardToRez" }];
          else if (cmd == "trigger") data = [{ prop: "card", key: "cardToTrigger" }];
          else if (cmd == "play") data = [{ prop: "card", key: "cardToPlay" }];
          else if (cmd == "score")
            data = [{ prop: "card", key: "cardToScore" }];
          else if (cmd == "trash")
            data = [{ prop: "card", key: "cardToTrash" }];
          else if (cmd == "advance")
            data = [{ prop: "card", key: "cardToAdvance" }];
          else if (cmd == "install")
            data = [
              { prop: "card", key: "cardToInstall" },
              { prop: "server", key: "serverToInstallTo" },
            ];
		  else if (cmd == "trace")
			data = [{ prop: "num", key: "strengthToIncrease" }];

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
                    this.preferred = null; //reset (don't reuse the preference)
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

    //check for mid-action with no preference set
    if (ret < 0 && choiceType == "select") {
      if (executingCommand == "trash") ret = this._bestTrashOption(optionList);
      else if (executingCommand == "install") {
        ret = this._bestInstallOption(optionList,false); //don't inhibit, this may be a free install/rez
		if (ret < 0) { //none found in options list? I guess we just need to return a default (but investigate, this isn't ideal)
			ret = 0; //since executing command is already set, we have to choose something!
			LogError(
			  "bestInstallOption failed to find any desired install options with this optionList:"
			);
			console.log(optionList);
		}
	  }
      else if (executingCommand == "discard")
        ret = this._bestDiscardOption(optionList);
      else if (executingCommand == "sabotage")
        ret = this._bestSabotageOption(optionList);
      else if (executingCommand == "advance")
        ret = this._bestAdvanceOption(optionList);
	  else if (executingCommand == "forfeit")
		ret = this._bestForfeitOption(optionList);
    }

    //call situational subroutine
    if (ret < 0) {
      if (optionList.indexOf("score") > -1) ret = this.Phase_Score(optionList);
	  if (ret > -1) return ret; //i.e. use score response if requested
      else if (currentPhase.identifier == "Run 4.1")
        ret = optionList.indexOf("success");
      //run success, don't rez anything at the moment
      else if (currentPhase.identifier == "Runner 2.2")
        ret = this.Phase_EOT(optionList);
      //opportunity to act at end of runner turn
      else if (currentPhase.title == "Trash Before Install")
        ret = this.Phase_TrashBeforeInstall(optionList);
      else if (currentPhase.identifier == "Run 2.1")
        ret = this.Phase_Approaching(optionList);
      else if (currentPhase.identifier == "Run 4.5")
        ret = this.Phase_Movement(optionList);
      else if (currentPhase.identifier == "Corp Mulligan")
        ret = this.Phase_Mulligan(optionList);
      else if (
        (currentPhase.identifier == "Corp 2.2" || currentPhase.identifier == "Corp 2.1") &&
        currentPhase.title == "Corporation's Action Phase"
      )
        ret = this.Phase_Main(optionList);
      else if (currentPhase.identifier == "Corp 2.2*")
        ret = this.Phase_PostAction(optionList);
	  else if (currentPhase.identifier == "Corp 3.2")
		ret = this.Phase_DiscardResponse(optionList);
    }

    //very specific checks
    if (ret < 0) {
      //Gain vs. Draw choice
      if (
        optionList.length == 2 &&
        typeof optionList[0].label !== "undefined" &&
        typeof optionList[1].label !== "undefined"
      ) {
        var gaindrawconcat =
          optionList[0].label.substring(0, 4) +
          optionList[1].label.substring(0, 4);
        var gainindex = -1;
        var drawindex = -1;
        if (gaindrawconcat == "GainDraw") {
          gainindex = 0;
          drawindex = 1;
        } else if (gaindrawconcat == "DrawGain") {
          gainindex = 1;
          drawindex = 0;
        }
        if (gainindex >= 0 && drawindex >= 0) {
          var gainamount = parseInt(
            optionList[gainindex].label.substring(5, 6)
          );
          var drawamount = parseInt(
            optionList[drawindex].label.substring(5, 6)
          );
          //simple logic for now is this: if draw would go over max hand size, let's not draw
          //also, if current credit pool is less than cards in hand, money probably needed
          //otherwise draw
          if (corp.HQ.cards.length + drawamount > MaxHandSize(corp)) {
            this._log("Hand pretty full, I think I'll take the cred");
            ret = gainindex;
          } else if (Credits(corp) < corp.HQ.cards.length) {
            this._log("Hmm, really need those credits right now");
            ret = gainindex;
          } else {
            this._log("I think I'll take the cards");
            ret = drawindex;
          }
        }
      }
    }

    if (ret < 0) {
      //no AI exists to handle this situation
      this._log("I don't have code to handle this situation: "+JSON.stringify([currentPhase.title, currentPhase.identifier, executingCommand, optionList]));
      ret = 0;
    }

    //return the chosen value
    return ret;
  }

  CommandChoice(optionList) {
	return new Promise((resolve) => {
		if (this.preferred !== null) {
		  if (optionList.indexOf(this.preferred.command) > -1) {
			resolve(optionList.indexOf(this.preferred.command));
			return;
		  }
		}
		if (optionList.length == 1) {
			resolve(0);
			return;
		}
		resolve(this.Choice(optionList, "command"));
		return;
	}); //end 'promise'
  }

  SelectChoice(optionList) {
	return new Promise((resolve) => {
		if (optionList.length == 1) {
		  if (this.preferred !== null) {
			if (executingCommand == this.preferred.command) this.preferred = null; //whether it succeeded or not, the preference is done
		  }
		  resolve(0);
		  return;
		}
		resolve(this.Choice(optionList, "select"));
		return;
	}); //end 'promise'
  }

  GameEnded(winner) {}
}
