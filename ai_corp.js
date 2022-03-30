//AI decisionmaking

class CorpAI {
  //**CORP UTILITY FUNCTIONS**
  _log(message) {
    //just comment this line to suppress AI log
    console.log("AI: " + message);
  }

  _iceInCardsCommon(
    serverToInstallTo,
    affordable,
    cards //utility used by affordable/not ice listers (affordable is a boolean)
  ) {
    if (typeof cards == "undefined") cards = corp.HQ.cards; //usually installing from hand but this makes other options possible
    var extraCost = 0;
    if (serverToInstallTo != null) extraCost += serverToInstallTo.ice.length; //take into account install cost if not first ice in server
    var relevantIceInCards = [];
    for (var i = 0; i < cards.length; i++) {
      if (cards[i].cardType == "ice") {
		if (extraCost < corp.creditPool) { //even not-affordable ice is excluded if it can't be installed
			if (affordable == (cards[i].rezCost + extraCost <= corp.creditPool) )
			  relevantIceInCards.push(cards[i]);
		}
      }
    }
    return relevantIceInCards;
  }

  _affordableIce(
    serverToInstallTo,
    cards //returns all ice in hand with cost equal to or less than credit pool
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

  _unrezzedIce(server) {
    var ret = [];
    if (server == null) return ret;
    for (var i = 0; i < server.ice.length; i++) {
      if (!server.ice[i].rezzed) ret.push(server.ice[i]);
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

  //returns the preferred server. input is the upgrade to install
  _bestServerToUpgrade(upgrade) {
    var preferredServer = null; //install into new if necessary
    var nonEmptyProtectedRemotes = this._nonEmptyProtectedRemotes();
    if (nonEmptyProtectedRemotes.length > 0)
      preferredServer = nonEmptyProtectedRemotes[0];
    else if (this._protectionScore(corp.HQ) < this._protectionScore(corp.RnD))
      preferredServer = corp.HQ;
    else preferredServer = corp.RnD;
    return preferredServer;
  }

  _isAScoringServer(
    server //note that this can includes servers with and without non-upgrade cards installed (so be careful what you would need to trash to install)
  ) {
    if (server == null) return false; //protection is too weak
    if (typeof server.cards == "undefined") {
      //is remote
      //no if its protection is too weak
      var protScore = this._protectionScore(server);
      var minProt = this._protectionScore(corp.HQ); //new method: just needs to be at least as strong as HQ
	  //var minProt = RandomRange(3, 4); //arbitrary: tweak as needed (old method)
      if (this._agendasInHand() > MaxHandSize(corp) - 1)
        minProt = this._protectionScore(corp.archives); //if it's going to be thrown out, it just has to be better protection than Archives
      if (protScore < minProt) return false;

      //yes if it has a scoring upgrade, an agenda or an ambush installed
      for (var j = 0; j < server.root.length; j++) {
        if (server.root[j].AIIsScoringUpgrade) return true;
        if (CheckCardType(server.root[j], ["agenda"])) return true;
        if (CheckSubType(server.root[j], "Ambush")) return true;
      }
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
	ret = this._protectionScore(server) - this._protectionScore(corp.HQ) + (0.3*this._clicksLeft()) + (Credits(corp)/(Credits(runner)+1.0)) - 1.0;
	return ret;
  }

  _shouldUpgradeServerWithCard(server, card) {
    if (CheckCardType(card, ["upgrade"])) {
      //just in case
      if (!this._uniqueCopyAlreadyInstalled(card)) {
        if (card.AIIsScoringUpgrade) {
          if (!this._isAScoringServer(server)) return false;
        }
        return true; //should be ok to install
      }
    }
    return false;
  }

  _upgradeInstallPreferences(
    server,
    cards //if server is not specified, the best server for each card will be chosen
  ) {
    var ret = [];
    if (typeof cards == "undefined") cards = corp.HQ.cards; //usually installing from hand but this makes other options possible
    for (var i = 0; i < cards.length; i++) {
      var serverToInstallTo = this._bestServerToUpgrade(cards[i]);
      if (typeof server !== "undefined") serverToInstallTo = server;
      if (this._shouldUpgradeServerWithCard(serverToInstallTo, cards[i]))
        ret.push({
          cardToInstall: cards[i],
          serverToInstallTo: serverToInstallTo,
        });
    }
    return ret;
  }

  _reducedDiscardList(
    optionList,
    minCount = 1 //reduces optionList (only include ones we are ok to discard) but keeps list size at or above minCount
  ) {
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
    //other than that, whatever for now
    return optionList;
  }

  _bestDiscardOption(optionList) {
    this._log("considering discard options...");
    optionList = this._reducedDiscardList(optionList);
    return 0; //just arbitrary for now
  }

  _bestAdvanceOption(optionList) {
    //currently just chooses first reasonable option (need to do more work here to rank them)
    for (var i = 0; i < optionList.length; i++) {
      var advancementLimit = 5;
      if (typeof optionList[i].card.AIAdvancementLimit == "function")
        advancementLimit = optionList[i].card.AIAdvancementLimit();
      if (
        typeof optionList[i].card.advancement === "undefined" ||
        optionList[i].card.advancement < advancementLimit ||
        optionList[i].card.AIOverAdvance
      )
        return i;
    }
    return 0; //just arbitrary
  }

  _agendaPointsInServer(
    server //returns int
  ) {
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

  _agendasInServer(
    server //returns int
  ) {
    var ret = 0;
    for (var i = 0; i < server.root.length; i++) {
      if (CheckCardType(server.root[i], ["agenda"])) ret++;
    }
    if (typeof server.cards !== "undefined") {
      for (var i = 0; i < server.cards.length; i++) {
        if (CheckCardType(server.cards[i], ["agenda"])) ret++;
      }
    }
    return ret;
  }
  
  _isHVT(card) { //agendas, ambushes, hostiles. 
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

  _agendasInHand() { //returns int
    return this._agendasInServer(corp.HQ);
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
	if (typeof(card.AIAdvancementLimit) == 'function') advlim = card.AIAdvancementLimit();
	var hostileCards = corp.RnD.cards.concat(corp.HQ.cards).concat(corp.archives.cards);
	for (var k=0; k<hostileCards.length; k++) {
		if (CheckSubType(hostileCards[k],"Hostile")) {
			if (typeof(hostileCards[k].AIAdvancementLimit) == 'function') {
				var hostadvlim = hostileCards[k].AIAdvancementLimit();
				if (hostadvlim > advlim) advlim = hostadvlim;
			}
		}
	}
	return advlim;
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
		if ( (agendasInHand > 0)&&(corp.HQ.cards.length - this._agendasInHand() < card.AITurnsInstalled) ) {
		  if (!CheckSubType(card, "Hostile") && CheckCardType(card, ["asset"]))
			//but not if it has credits left
			if (!CheckCounters(card, "credits", 1)) {
				return true;
			}
		}
	}
    return false;
  }

  _aCompatibleBreakerIsInstalled(
    iceCard //ignores strength and credit requirements
  ) {
    var installedRunnerCards = InstalledCards(runner);
    for (var i = 0; i < installedRunnerCards.length; i++) {
      if (CheckSubType(installedRunnerCards[i], "Icebreaker")) {
        if (CheckSubType(installedRunnerCards[i], "AI")) return true;
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
        if (CheckSubType(breakerCard, "AI")) ret++;
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
			if (typeof card.hostedCards !== "undefined") {
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
		if (typeof(card.AIDefensiveValue) !== 'undefined') {
			//if unrezzed and can't afford to rez, consider to be no protection (just a simple check ignoring cost of other ice in server)
			if ( card.rezzed || Credits(corp) >= RezCost(card)) {
				ret += card.AIDefensiveValue;
			}
		}
	}
    return ret;
  }

  _protectionScore(
    server //higher number = more protected
  ) {
    //new servers have a score of 1 (because they are empty)
    if (server == null) return 1;
    //for 'protecting' check we build a score considering how much ice and how effective the ice is
    var ret = 0;
    for (var i = 0; i < server.ice.length; i++) {
      ret += this._cardProtectionValue(server.ice[i]);
    }
    for (var i = 0; i < server.root.length; i++) {
      ret += this._cardProtectionValue(server.root[i]);
    }
    //if it is being run successfully a lot, need extra protection
    if (typeof server.AISuccessfulRuns !== "undefined")
      ret -= Math.round(Math.sqrt(server.AISuccessfulRuns));
    //if it is archives we will deprioritise protection by default
    if (server == corp.archives) ret += 3; //archives (the 3 is arbitrary)
	//if it HQ, increase or decrease priorisation based on agenda points compared to cards in hand
	if (server == corp.HQ) ret += corp.HQ.cards.length - this._agendaPointsInServer(corp.HQ) - 2.5; //the subtracted value is arbitrary (with 2 the AI was underprotective of HQ)
    return ret;
  }

  _serverToProtect(
    ignoreArchives = false, //returns the server that most needs increased protection (does not return null, will be HQ by default or R&D against shapers)
	outputToLog = false
  ) {
    var protectionScores = {};

    var serverToProtect = corp.HQ;
    if (runner.identityCard.faction == "Shaper") serverToProtect = corp.RnD;
    var protectionScore = this._protectionScore(serverToProtect);

    protectionScores.HQ = this._protectionScore(corp.HQ);
    if (protectionScores.HQ < protectionScore) {
      serverToProtect = corp.HQ;
      protectionScore = protectionScores.HQ;
    }

    protectionScores.RnD = this._protectionScore(corp.RnD);
    if (protectionScores.RnD < protectionScore) {
      serverToProtect = corp.RnD;
      protectionScore = protectionScores.RnD;
    }
    for (var i = 0; i < corp.remoteServers.length; i++) {
      protectionScores[corp.remoteServers[i].serverName] =
        this._protectionScore(corp.remoteServers[i]);
      if (this._isAScoringServer(corp.remoteServers[i]))
        protectionScores[corp.remoteServers[i].serverName] -=
          this._agendasInHand(); //scoring servers need more protection than other remotes (and the more agendas in hand, the more need to strengthen them
      if (
        protectionScores[corp.remoteServers[i].serverName] < protectionScore
      ) {
        serverToProtect = corp.remoteServers[i];
        protectionScore = protectionScores[corp.remoteServers[i].serverName];
      }
    }
    if (this._emptyProtectedRemotes().length == 0) {
      protectionScores["null"] = this._protectionScore(null);
      if (protectionScores["null"] < protectionScore) {
        serverToProtect = null;
        protectionScore = protectionScores["null"];
      }
    }
	if ( ( serverToProtect==null || typeof(serverToProtect.cards == 'undefined') ) && this._HVTsInstalled() > 0 ) { //protect a HVT server instead of other remotes
		if (!this._HVTsInServer(serverToProtect)) { //this server is fine if it has a HVT
			//don't update the protection score - don't compare archives to the HVT server
			serverToProtect = this._HVTserver();
		}
	}
    if (!ignoreArchives) {
      protectionScores.archives = this._protectionScore(corp.archives);
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
      if (this._protectionScore(corp.remoteServers[i]) > protectionScore) {
        bestProtectedRemote = corp.remoteServers[i];
        protectionScore = this._protectionScore(bestProtectedRemote);
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
          if (!this._obsoleteBluff(corp.remoteServers[i].root[j]))
            hasRoom = false;
        }
      }
      if (corp.remoteServers[i].ice.length > 0 && hasRoom) {
        //insert into ret in order by finding the relevant index
        var thisProtectionScore = this._protectionScore(corp.remoteServers[i]);
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

  _nonEmptyProtectedRemotes() { //returns a list of remote servers which are not empty (contain an asset or agenda) and have ice in front
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
        if (CheckCredits(currentRezCost, corp, "rezzing", card)) ret.push(card);
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

  //returns int
  _copiesOfCardIn(title, cards) {
	var ret=0;
    for (var i = 0; i < cards.length; i++) {
      if (GetTitle(cards[i]) == title) ret++;
    }
    return ret;
  }

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
  _bestInstallOption(optionList) {
    //make a cards list from optionList (since this could be hand, archives, card-generated list, etc)
    var cards = [];
    for (var i = 0; i < optionList.length; i++) {
      if (typeof optionList[i].card !== "undefined") {
        if (!cards.includes(optionList[i].card)) cards.push(optionList[i].card);
      }
    }
    //now rank them
    var rankedInstallOptions = this._rankedInstallOptions(cards);
    for (var j = 0; j < rankedInstallOptions.length; j++) {
      for (var i = 0; i < optionList.length; i++) {
        if (
          optionList[i].card == rankedInstallOptions[j].cardToInstall &&
          optionList[i].server == rankedInstallOptions[j].serverToInstallTo
        )
          return i;
      }
    }
	//no desirable option
    return -1;
  }

  _bestMainPhaseEconomyOption(optionList) {
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
    //could implement these on-card instead? (e.g. as AIEconomyCard)
    var canPlay = optionList.indexOf("play") > -1;
    var canInstall = optionList.indexOf("install") > -1;
    var economyCards = [];
    economyCards.push("Government Subsidy");
    economyCards.push("Hedge Fund");
    if (this._agendasInHand() < corp.HQ.cards.length - 1)
      economyCards.push("Hansei Review"); //only if there is at least 1 non-agenda card (other than this) in HQ
    //if (emptyProtectedRemotes.length > 0 || this._clicksLeft() > 1)
      economyCards.push("Regolith Mining License"); //regolith is only of value if there will be an opportunity to use it? disabled that proviso for now since trash cost is fairly high
    economyCards.push("Nico Campaign");
    economyCards.push("Melange Mining Corp.");
    economyCards.push("PAD Campaign");
    economyCards.push("Predictive Planogram");

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
    var installedCards = InstalledCards(corp);
    for (var i = 0; i < installedCards.length; i++) {
      if (CheckRez(installedCards[i], ["ice", "asset", "upgrade"])) {
        //if a rezzable card...
        if (economyCards.includes(GetTitle(installedCards[i]))) {
          //is an economy card
          var currentRezCost = RezCost(installedCards[i]);
          if (
            CheckCredits(currentRezCost, corp, "rezzing", installedCards[i])
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

	  //maybe something to rez
      if (optionList.includes("rez")) {
      for (var i = 0; i < installedCards.length; i++) {
        if (CheckRez(installedCards[i], ["ice", "asset", "upgrade"])) {
          //if a rezzable card...
          if (drawCards.includes(GetTitle(installedCards[i]))) {
            //is an draw card
            var currentRezCost = RezCost(installedCards[i]);
            if (
              CheckCredits(currentRezCost, corp, "rezzing", installedCards[i])
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

      //otherwise just basic action is fine, unless last click and potentiall bringing an agenda into weaker protection
      var drawIsOK = true;
	  if (this._clicksLeft() < 2) {
		  if (this._protectionScore(corp.HQ) < this._protectionScore(corp.RnD)) {
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

    //can I afford to spring all my ambushes and hostiles?
    var ambushCosts = [
      { title: "Aggressive Secretary", cost: 2 },
      { title: "Ghost Branch", cost: 0 },
      { title: "Project Junebug", cost: 1 },
      { title: "Snare!", cost: 4 },
      { title: "Urtica Cipher", cost: 0 },
      { title: "Manegarm Skunkworks", cost: 2 },
      { title: "Anoetic Void", cost: 0 },
      { title: "Clearinghouse", cost: 0 },
    ];
    for (var i = 0; i < corp.remoteServers.length; i++) {
      for (var j = 0; j < corp.remoteServers[i].root.length; j++) {
        for (var k = 0; k < ambushCosts.length; k++) {
          if (GetTitle(corp.remoteServers[i].root[j]) == ambushCosts[k].title)
            totalCost += ambushCosts[k].cost;
        }
      }
    }

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
	priorityOnly=false //set true to exclude low priorities like unaffordable ice or non-ice into new server
  ) {
    var ret = [];
    //Check if there are any assets in cards that are worth installing
    //Include relevant checks in their function e.g. emptyProtectedRemotes.length > 0
    //And return -1 (don't install), 0 to emptyProtectedRemotes.length-1 (install in this server), or emptyProtectedRemotes.length (install in a new server)
    var emptyProtectedRemotes = this._emptyProtectedRemotes();
    for (var i = 0; i < cards.length; i++) {
      if (!this._uniqueCopyAlreadyInstalled(cards[i])) {
        if (typeof cards[i].AIWorthInstalling == "function") {
          var installPreference = cards[i].AIWorthInstalling(
            emptyProtectedRemotes
          );
          if (installPreference > -1) {
            if (installPreference > emptyProtectedRemotes.length - 1)
              ret.push({ cardToInstall: cards[i], serverToInstallTo: null });
            //new server
            else
              ret.push({
                cardToInstall: cards[i],
                serverToInstallTo: emptyProtectedRemotes[installPreference],
              });
          }
        }
      }
    }

    //Find out if any servers need protection. If so, we will choose an ice card if possible.
    var serverToInstallTo = this._serverToProtect();
    if (
      this._unrezzedIce(serverToInstallTo).length == 0 ||
      this._sufficientEconomy(false, 4)
    ) {
      //this is our worst-protected server. if the server already has unrezzed ice, let's not install ice unless super rich (the 4 is arbitrary)
      //prioritise placing ice that I can afford to rez (for now we make no effort to sort them)
	  ret = ret.concat(this._iceInstallOptions(serverToInstallTo, cards, priorityOnly));
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
			});
		  }
		} else if (CheckCardType(cards[i], ["asset"])) {
		  //if installing from archives, creating a new server is fine (what's to lose? uh except: when needed, add an exception for 'trashed while being accessed' cards)
		  var assetDestinations = emptyProtectedRemotes;
		  if (cards[i].cardLocation == corp.archives.cards) assetDestinations = assetDestinations.concat([null]);
		  //loop through unlikely scoring servers (in order from strongest to weakest)
		  for (var j = 0; j < assetDestinations.length; j++) {
			serverToInstallTo = assetDestinations[j];
			if (!this._isAScoringServer(serverToInstallTo)) {
			  serverToInstallTo =
				assetDestinations[
				  RandomRange(0, assetDestinations.length - 1)
				]; //just whatever for now
			  intoServerOptions.push({
				cardToInstall: cards[i],
				serverToInstallTo: serverToInstallTo,
			  });
			}
		  }
		}
	}
	//calculate scoring window for each scoring server (by index in scoringServers)
	var scoringWindows = [];
	for (var i=0; i<scoringServers.length; i++) {
		scoringWindows.push(this._scoringWindow(scoringServers[i]));
	}
	this._log("Scoring windows: "+JSON.stringify(scoringWindows));
	//sort options based on scoring window (closest to scoring window value is best i.e. first)
	intoServerOptions.sort(function(a,b) {
		var aAdvReq = AdvancementRequirement(a.cardToInstall);
		var bAdvReq = AdvancementRequirement(b.cardToInstall);
		if (typeof(a.cardToInstall.AIAdvancementLimit) == 'function') aAdvReq = a.cardToInstall.AIAdvancementLimit;
		if (typeof(b.cardToInstall.AIAdvancementLimit) == 'function') bAdvReq = b.cardToInstall.AIAdvancementLimit;
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
	ret = ret.concat(intoServerOptions);

    //Upgrade?
    serverToInstallTo = this._bestProtectedRemote();
    if (serverToInstallTo == null)
      serverToInstallTo = this._serverToProtect(true); //true means don't install to archives
    ret = ret.concat(this._upgradeInstallPreferences(serverToInstallTo, cards));

    //If no protected empty remote exists, let's make one if prudent
	//otherwise just add ice to whatever server needs it most
    serverToInstallTo = null;
    if (emptyProtectedRemotes.length > 0)
      serverToInstallTo = this._serverToProtect();
	ret = ret.concat(this._iceInstallOptions(serverToInstallTo, cards, priorityOnly));
	
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
	  if (AgendaPoints(runner) + this._agendaPointsInServer(server) >= AgendaPointsToWin()) return true;
	  return false;
  }

  //returns true to rez, false not to
  //passing the rez cost is an optimisation
  _iceWorthRezzing(card, currentRezCost) {
	  var rezIce = true;
	  var server = GetServer(card);
	  if (typeof currentRezCost == 'undefined') {
		  currentRezCost = RezCost(card);
	  }
	  //make sure there isn't better ice this will prevent us from rezzing
	  var thisServerValue = this._serverValue(server);
	  var thisIceProtectionValue = this._cardProtectionValue(card);
	  var serversToCompare = [];
	  if (corp.archives !== server) serversToCompare.push(corp.archives);
	  if (corp.RnD !== server) serversToCompare.push(corp.RnD);
	  if (corp.HQ !== server) serversToCompare.push(corp.HQ);
	  for (var i=0; i<corp.remoteServers.length; i++) {
		if (corp.remoteServers[i] !== server) {
			serversToCompare.push(corp.remoteServers[i]);
		}
	  }
	  for (var i=0; i<serversToCompare.length; i++) {
		  var serverToCompare = serversToCompare[i];
		  var comparisonValue = this._serverValue(serverToCompare);
		  for (var j=0; j<serverToCompare.ice.length; j++) {
			if (!serverToCompare.ice[j].rezzed) {
				if (!CheckCredits(currentRezCost+RezCost(serverToCompare.ice[j]), corp, "rezzing")) {
					if ( (comparisonValue > thisServerValue) ||
						 ((comparisonValue == thisServerValue) && (this._cardProtectionValue(serverToCompare.ice[j]) > thisIceProtectionValue)) ) {
					  this._log("Rez cost not worth it, need to save it for "+serverToCompare.ice[j].title+" in "+ServerName(serverToCompare));
					  rezIce = false;
					}
					else this._log("Rez this is better than "+serverToCompare.ice[j].title+" in "+ServerName(serverToCompare));
				}
			}
		  }
	  }
	  //also consider if there is a defensive upgrade worth rezzing in this server instead
	  for (var i=0; i<server.root.length; i++) {
		if (typeof(server.root[i].AIDefensiveValue) !== 'undefined') {
		  if (!server.root[i].rezzed) {
			if (!CheckCredits(currentRezCost+RezCost(server.root[i]), corp, "rezzing")) {
			  if (this._cardProtectionValue(server.root[i]) > thisIceProtectionValue) {
				this._log("Rez cost not worth it, need to save it for "+server.root[i].title+" in this server");
				rezIce = false;
			  }
			  else this._log("Rez this is better than "+server.root[i].title+" in this server");
			}
		  }
		}
	  }	  
	  //if a card is hosted (e.g. Tranquilizer) only rez if super rich (the *5 is arbitrary, observe and tweak)
	  //unless breaching could mean game loss
	  if (!this._runnerMayWinIfServerBreached(server)) {
		  if ( (typeof(card.hostedCards) !== 'undefined') && (card.hostedCards.length > 0) && (Credits(corp) < currentRezCost*5) ) {
			  rezIce = false;
		  }
	  }	  
	  //there may be other reasons to leave this ice unrezzed (e.g. allow into an ambush)
	  if (this._iceToLeaveUnrezzed(server) == card) {
		  rezIce = false;
	  }
	  //special exceptions:
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
			  currentRezCost + RezCost(iceBehind),
			  corp,
			  "rezzing",
			  iceBehind
			)
		  )
			rezIce = true;
		}
	  }
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
        if (CheckCredits(currentRezCost, corp, "rezzing", card)) {
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
      //(none at the moment)
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
        if (GetTitle(card) == "Manegarm Skunkworks" || wouldTriggerThis) {
          //make sure we can do it
          if (CheckRez(card, ["upgrade"])) {
            //does not check cost...
            var currentRezCost = RezCost(card); //...so we check that here
            if (CheckCredits(currentRezCost, corp, "rezzing", card))
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
        "Nico Campaign",
        "Regolith Mining License",
        "Melange Mining Corp.",
        "PAD Campaign",
        "Clearinghouse",
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
      var cardsToRezPostAction = [];
      if (this._clicksLeft() > 0)
        cardsToRezPostAction.push("Regolith Mining License");
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
    //are there things we could install first to benefit?
    if (this._clicksLeft() > 0) {
      for (var i = 0; i < corp.HQ.cards.length; i++) {
        var card = corp.HQ.cards[i];
        if (typeof card.AIWouldRezBeforeScore !== "undefined") {
          if (
            card.AIWouldRezBeforeScore.call(card, cardToScore, serverToScoreIn)
          ) {
            if (CheckCredits(RezCost(card), corp, "rezzing", card)) {
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
      }
    }
    return this._returnPreference(optionList, "score", {
      cardToScore: cardToScore,
    });
  }

  _potentialAdvancement(card,thisTurn=true) {
	  var ret = 0;
	  //basic advance
	  if (thisTurn) ret += Math.min(this._clicksLeft(), Credits(corp));
	  else ret += Credits(corp);
	  //check if any Seamless Launch in hand
	  var slih = this._copyOfCardExistsIn("Seamless Launch",corp.HQ.cards);
	  if (slih) {
		  if (!thisTurn || !slih.cardsInstalledThisTurn.includes(card)) {
			//plus one for each Seamless Launch if it can be used
			ret += this._copiesOfCardIn("Seamless Launch",corp.HQ.cards);
		  }
	  }
	  return ret;
  }
  
  _advancementRequired(card) {
	  return AdvancementRequirement(card) - Counters(card,"advancement");
  }

  _isFullyAdvanceableAgenda(card) { //can be finished and scored this turn
	if (!CheckCardType(card, ["agenda"])) return false;
	if (!CheckScore(card,true)) return false; //the true means ignore advancement requirement
	var canFullyAdvance = this._potentialAdvancement(card,true) >= this._advancementRequired(card);
	return canFullyAdvance;
  }

  //returns true if the card should be played
  //TODO use functions like this more widely rather than having copies of similar code
  _commonCardToPlayChecks(cardToPlay,msg="",logwillplay=false) {
	if (cardToPlay) {
	  this._log("there is a card to play "+msg);
	  var playThis = true; //if no specific rules have been defined then just play it whenever you can
	  if (typeof(cardToPlay.AIWouldPlay) == 'function') playThis = cardToPlay.AIWouldPlay.call(cardToPlay);
	  if (playThis&&FullCheckPlay(cardToPlay)) {
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

	//check for an almost-done agenda, if so prioritise it for advancing
	var almostDoneAgenda = null;
	if (optionList.indexOf("advance") > -1) {
		for (var i = 0; i < corp.remoteServers.length; i++) {
			for (var j = 0; j < corp.remoteServers[i].root.length; j++) {
			  if (CheckAdvance(corp.remoteServers[i].root[j]) && this._isFullyAdvanceableAgenda(corp.remoteServers[i].root[j])) {
				  if (almostDoneAgenda) {
					  //assume the one with the higher printed advancement requirement or agendaPoints is better
					  if ((corp.remoteServers[i].root[j].advancementRequirement > almostDoneAgenda.advancementRequirement) ||
					    (corp.remoteServers[i].root[j].agendaPoints > almostDoneAgenda.agendaPoints)) {
					    almostDoneAgenda = corp.remoteServers[i].root[j];
					    this._log("This would be even better");
					  }
				  }
				  else {
					  almostDoneAgenda = corp.remoteServers[i].root[j];
					  this._log("I could get this done this turn");
				  }
			  }
			}
		}
	}
	if (!almostDoneAgenda) {
		//take advantage of a temporary window of opportunity (i.e., play right away)
		if (optionList.includes("play")) {
		  var useWhenCanCards = [
			"Neurospike", //agendas scored
			"Public Trail", //successful run
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
		//or trigger right away
		if (optionList.includes("trigger")) {
		  var useWhenCanCards = [
			"Spin Doctor", //it has been rezzed
		  ];
		  for (var i = 0; i < useWhenCanCards.length; i++) {
			var arraysToCheck = [];
			for (var j=0; j<corp.remoteServers.length; j++) {
				arraysToCheck = arraysToCheck.concat(corp.remoteServers[j].root);
			}
			var cardToTrigger = this._copyOfCardExistsIn(
			  useWhenCanCards[i],
			  arraysToCheck
			);
			if (cardToTrigger) {
			  this._log("there is a card with a window of opportunity");
			  if (cardToTrigger.rezzed) { //for now we will assume it can be triggered
				this._log("I could trigger it");
				return this._returnPreference(optionList, "trigger", {
				  cardToTrigger: cardToTrigger,
				});
			  }
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
    if ( (almostDoneAgenda || sufficientEconomy) && optionList.indexOf("advance") > -1) {		
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
            //don't advance past 5 (thats the largest agenda in this deck) or some other limit if specified
            var advancementLimit = 5;
			if (CheckCardType(card,["agenda"])) {
				advancementLimit = card.advancementRequirement;
			}
            if (
              typeof card.AIAdvancementLimit ==
              "function"
            )
              advancementLimit =
                card.AIAdvancementLimit();
			//if the card is an ambush, check for higher-advance to bluff as
			if (CheckSubType(card,"Ambush")) {
				var blufflim = this._bluffAdvanceLimit(card);
				if (blufflim > advancementLimit) advancementLimit = blufflim;
			}
			//don't start advancing if too poor to finish the job (the false means not necessarily this turn) or agenda in weak server
			var startOrContinueAdvancement = false;
			if (card.advancement > 0) startOrContinueAdvancement = true; //already started, feel free to continue (the counter shows the runner it is advanceable)
			else if (!CheckCardType(card, ["agenda"]) || card == almostDoneAgenda || this._protectionScore(corp.remoteServers[i]) > this._protectionScore(corp.HQ)) {
				if (this._potentialAdvancement(card,false) >= advancementLimit) startOrContinueAdvancement = true;
			}
			if ( startOrContinueAdvancement ) {
				if (
				  typeof card.advancement ===
					"undefined" ||
				  card.advancement < advancementLimit ||
				  card.AIOverAdvance
				) {
				  this._log("I could advance a card");
				  //if there is an economy advance card in hand, consider using it
				  cardToPlay = this._copyOfCardExistsIn(
					"Seamless Launch",
					corp.HQ.cards
				  );
				  if ( cardToPlay && (card == almostDoneAgenda) || card.AIRushToFinish ) { //for now let's just use Seamless for finishing agendas or specific cards
					this._log("there is an economy advance");
					if (FullCheckPlay(cardToPlay) && optionList.includes("play")) {
					  this._log("I could play it");
					  if (
						Counters(card,"advancement") <
						advancementLimit - 1 ||
						card.AIOverAdvance
					  ) {
						this._log("I intend to");
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
          if (CheckCardType(installedCards[i], ["ice"])) {
            var advancementLimit = 5; //arbitrary
            if (typeof installedCards[i].AIAdvancementLimit == "function")
              advancementLimit = installedCards[i].AIAdvancementLimit();
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
            this._protectionScore(rankedInstallOptions[0].serverToInstallTo) >
              1 ||
            (this._clicksLeft() > 2 &&
              this._affordableIce(rankedInstallOptions[0].serverToInstallTo))
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
        ret = this._bestInstallOption(optionList);
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
      else if (executingCommand == "advance")
        ret = this._bestAdvanceOption(optionList);
    }

    //call situational subroutine
    if (ret < 0) {
      if (optionList.indexOf("score") > -1) ret = this.Phase_Score(optionList);
      else if (currentPhase.identifier == "Run 4.1")
        ret = optionList.indexOf("success");
      //run success, don't rez anything at the moment
      else if (currentPhase.identifier == "Runner 2.2")
        ret = this.Phase_EOT(optionList);
      //opportunity to act at end of runner turn
      else if (currentPhase.title == "Trash Before Install")
        ret = this.Phase_TrashBeforeInstall(optionList);
      else if (currentPhase.identifier == "Run 2.2")
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
    if (this.preferred !== null) {
      if (optionList.indexOf(this.preferred.command) > -1)
        return optionList.indexOf(this.preferred.command);
    }
    if (optionList.length == 1) return 0;
    return this.Choice(optionList, "command");
  }

  SelectChoice(optionList) {
    if (optionList.length == 1) {
      if (this.preferred !== null) {
        if (executingCommand == this.preferred.command) this.preferred = null; //whether it succeeded or not, the preference is done
      }
      return [0];
    }
    return this.Choice(optionList, "select");
  }

  GameEnded(winner) {}
}
