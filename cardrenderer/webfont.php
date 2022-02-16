<?php
		echo '<style>';
		echo '	@font-face {';
		echo '	  font-family: PlayBoldNisei;';
		echo "		src: url('cardrenderer/Play-Bold-Nisei.ttf?".filemtime('cardrenderer/Play-Bold-Nisei.ttf')."');";
		echo '	  font-weight: bold;';
		echo '	}';
		echo '</style>';
		echo '<script src="cardrenderer/webfont.js"></script>';
		echo '<script>';
		echo '	WebFont.load({';
		echo '		custom: {';
		echo '			families: [';
		echo "				'PlayBoldNisei'";
		echo '			]';
		echo '		}';
		echo '	});';
		echo '</script>';
?>