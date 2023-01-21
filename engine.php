<!DOCTYPE html>
<html>
	<head>
		<meta charset="utf-8">
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<meta name="robots" content="noindex">
		<title>Chiriboga</title>
		<link href="images/favicon.ico" rel="icon">
		<?php
		echo '<link rel="stylesheet" type="text/css" href="style.css?' . filemtime('style.css') . '" />';
		?> 
		<link rel="manifest" href="manifest.json">
		<script src="jquery/jquery-3.2.1.min.js"></script>
		<script src="cardrenderer/pixi.min.js"></script>
		<script src="cardrenderer/pixi-particles.min.js"></script>
		<?php
		echo '<script src="cardrenderer/particlesystems.js?' . filemtime('cardrenderer/particlesystems.js') . '"></script>';
		echo '<script src="cardrenderer/cardrenderer.js?' . filemtime('cardrenderer/cardrenderer.js') . '"></script>';
		include 'cardrenderer/webfont.php';
		?>
		<script src="deck/lz-string.min.js"></script>
		<script src="deck/seedrandom.min.js"></script>
		<script>
			var cardSet = []; //prepare to receive card definitions
			var setIdentifiers = []; //set identifiers
		</script>
		<?php
		echo '<link rel="stylesheet" type="text/css" href="style.css?' . filemtime('style.css') . '" />';
		$jsfiles = array('init','phase', 'command', 'checks', 'mechanics', 'utility');
		$sets = ["systemgateway","systemupdate2021"];
		if (isset($_GET['sets'])) {
			$sets = explode("-",preg_replace( "/[^a-zA-Z0-9-]/", "", $_GET['sets'] )); 
		}
		foreach ($sets as $set) {
			array_push($jsfiles, 'sets/'.$set);
		}
		$jsfiles = array_merge($jsfiles, array('sets/tutorial', 'decks', 'runcalculator', 'ai_corp', 'ai_runner'));
		$maxfilemtime = 0;
		foreach ($jsfiles as $jsfile) {
			$thisfilemtime = filemtime($jsfile.'.js');
			echo '<script src="'.$jsfile.'.js?' . $thisfilemtime . '"></script>';
			if ($thisfilemtime > $maxfilemtime) {
				$maxfilemtime = $thisfilemtime;
			}
		}
		echo '<script>var versionReference=' . $maxfilemtime . ';</script>';
		?> 
	</head>

	<body id="body" onload="Init();">
		<div id="contentcontainer" class="content">
			<div id="output"></div>
			<form id="cmdform">
				<input type="submit" value="Submit">
				<span id="turnphase"></span>
				<input id="command" type="text" value="">
			</form>
		</div>
		<div id="menubar"><button onclick="$('#menu').css('display','flex'); if (document.fullscreen) document.exitFullscreen(); $('.fullscreen-button').show();"><img src="images/chiriboga_withtext.png"></button></div>
		<div id="header"></div>
		<button class="fullscreen-button" onclick="document.getElementById('body').requestFullscreen({ navigationUI: 'hide' }); $('.fullscreen-button').hide();"></button>
		<div id="fps"></div>
		<div id="footer"></div>
		<div id="modal" class="modal">
			<div id="modalcontent" class="modal-content"></div>
		</div>
		<div id="history-wrapper">
			<div id="history"></div>
		</div>
		<div id="loading" class="modal" style="display:flex;">
			<div class="modal-content-inactive"><h1 id="loading-text">Deckbuilding...<h1></div>
		</div>
		<div id="menu" class="modal">
			<div id="menucontent" class="modal-content-inactive">
				<span onclick="$('#menu').css('display','none');" class="close-cross">X</span>
				<h1>Chiriboga</h1>
				<button id="exittomenu" onclick="window.location.href='index.php';" class="button">Exit to main menu</button>
				<button id="editdeck" onclick="window.location.href='decklauncher.php';" class="button">Edit this deck</button>
				<button id="randomdeck" onclick="window.location.href='decklauncher.php';" class="button">Edit new random deck</button>
				<div style="float:right;" class="options">
					<label for="narration"><input type="checkbox" id="narration">Narrate AI</label>
				</div>
				<p>Chiriboga implements the game <a href="https://nullsignal.games/about/netrunner/">Android: Netrunner</a> with an AI opponent. Source is <a href="https://github.com/bobtheuberfish/chiriboga">available on github</a>.</p>
				<p>Includes all cards in Null Signal Games' <a href="https://nullsignal.games/products/system-gateway/">System Gateway</a> set. Card front art is the property of Null Signal Games.<br/>
				Includes <a href="https://nullsignal.games/about/nisei-visual-assets/">game symbols permitted for use by Null Signal Games</a> under CC BY-ND 4.0.<br/>
				Chiriboga is not endorsed by Null Signal Games.</p>
				<p class="acknowledgements">Special thanks to testers, including: <em>BadEpsilon, bowlsley, D-Smith, eniteris, Kwaice, Mentlegen, R41B, saff, Saintis, Ysengrin</em>.</p>
				<p class="disclaimer">Netrunner and Android are trademarks of Fantasy Flight Publishing, Inc. and/or Wizards of the Coast LLC.<br/>
				Chiriboga is not affiliated with Fantasy Flight Games or Wizards of the Coast.</p>
				<p><a href="https://netrunnerdb.com/en/card/26098"><em>...but who ordered him to wear that hat?</em></a></p>
				<button onclick="DownloadCapturedLog();" class="button">Download captured log</button> (for <a href="https://github.com/bobtheuberfish/chiriboga/issues">error reporting</a>)
				<select id="rewind-select" style="float:right;" disabled>
					<option value="">Rewind</option>
				</select>
				<br/><br/>
			</div>
		</div>
	</body>
</html>
