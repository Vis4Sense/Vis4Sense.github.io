/**
 * Created by gphillips on 01/06/2016.
 */

/**
 * Word cloud viusalisation and processing
 * @returns {module}
 */
sm.misc.wordCloud = function () {

	var STOP_WORDS = "|"
		+ "all|am|an|and|any|are|as|at|be|been|but|by|"
		+ "for|from|"
		+ "had|has|have|he|here|his|hers|how|if|in|is|it|its|"
		+ "jr|"
		+ "may|me|more|my|no|none|not|now|of|off|on|one|or|our|ours|out|over|"
		+ "pm|re|"
		+ "she|so|that|the|their|there|they|this|to|up|us|"
		+ "was|we|were|which|who|why|will|with|without|"
		+ "you|your|yours|";

	/**
	 * Main entry point, constructs the word cloud.
	 * @param metrics the measurement of the selected items
	 * @param items all visible items
	 * @param theme the theme to filter the visible items on ("" = all themes)
	 */
	function module(metrics, items, theme) {

		/**
		 * Returns the trust badge URL from the mean rating
		 * @param metrics
		 * @returns {*}
		 */
		function getTrustColour(metrics) {
			if (metrics.meanRatedLevel >= 2.5) {
				return "#01a64b";
			}
			else if (metrics.meanRatedLevel >= 1.5) {
				return "#f5a623";
			}
			else if (metrics.meanRatedLevel > 0.0) {
				return "#d0021a";
			}
			return "#eeeeee";
		}

		// Index the visible items
		var map = d3.map();
		items.forEach(function(d) {

			if (theme === "" || (d.themes && d.themes.indexOf(theme) >= 0)) {
				// Index the title
				module.parse(d.title, map);

				//// For articles, also index the content
				//if (d.sourceType === "Article") {
				//	module.parse(d.content, map);
				//}
			}
		});

		// Find the top ten words
		var TOP = 10;
		var popular = [{"text": "", "size": 0}];

		// Get the most popular words from the map. There is an optimisation being performed:
		// 1. Compare the popularity with the least popular item in the top table.
		// 2. If the new word is more popular, get rid of the last item and then insert the new item
		// at the position that maintains the descending order of popularity.
		map.forEach(function(key, value) {

			// If this item is more popular than the tail then remove the tail
			if (value > popular[popular.length - 1].size) {
				if (popular.length >= TOP) {
					popular.pop();
				}

				// Now compare the key with items in the popular table from the top.
				for (var i = 0; i < popular.length; i++) {
					if (value > popular[i].size) {
						// This key is more popular. Insert it here.
						popular.splice(i, 0, {"text": key, "size": value});
						break;
					}
				}
			}
		});

		// Find the maximum number of occurrences of a unique word for scaling. The method of finding the most popular
		// words results in a natually sorted table, so we simply get the first item.
		var maxSize = popular[0].size;

		// TODO PROV-55 determine the size of the container and use it to set the SVG size.
		var width = 233;
		var height = 120;

		// All-horizontal layout, with each word's size proportional to its popularity.
		d3.layout.cloud()
			.words(popular)
			.size([20 + width, 10 + height])
			.fontSize(function (d) {
				return 20 + 20 * d.size / maxSize;
			})
			.rotate(0)
			.on("end", update)
			.start();

		// Replace the image in the container.
		function update() {
			module.removeVis();
			d3.select(".word-cloud-graph-container")
				.append("svg")
				.attr("width", width)
				.attr("height", height)
				.attr("class", "word-cloud-graph")
				.style("background-color", getTrustColour(metrics))
				.append("g")
				.attr("transform", "translate(" + (timesetsProperties.wordCloudText_dx + width / 2) + ", " + (timesetsProperties.wordCloudText_dy + height / 2) + ")")
				.selectAll("text")
				.data(popular)
				.enter().append("text")
				.style("font-size", function (d) {
					return (d.size / 2) + "px";
				})
				.style("fill", "white")
				.attr("transform", function (d) {
					return "translate(" + [d.x, d.y] + ")rotate(" + d.rotate + ")";
				})
				.text(function (d) {
					return d.text;
				});

			module.addButton("Copy", "copy", function() {
				//TODO: click handler for copy word cloud button
			});
		}
	}

	/**
	 * Adds a command button to the pane
	 * @param id
	 * @param caption
	 * @param onclick
	 */
	module.addButton = function(caption, id, onclick) {
		d3.select(".word-cloud .button-bar").append("div")
			.attr("class", "button word-cloud-button")
			.attr("id", id)
			.text(caption)
			.on("click", onclick);
	};

	/**
	 * Removes the visualisation from the display.
	 */
	module.removeVis = function() {
		d3.select(".word-cloud-graph").remove();
		d3.select(".word-cloud .button-bar #copy").remove();
	};

	/**
	 * Parses text and counts the occurrences of each unique word.
	 * @param text the text to be parsed
	 * @param map the map of keyword counts to be updated and/or appended to
	 */
	module.parse = function(text, map) {
		// Extract words from text.
		var tokens = text.toLowerCase().match(/[a-z][a-z]+/g);

		tokens.forEach(function(token) {

			// Remove punctuation
			var key = token.trim();

			if (key !== "" && STOP_WORDS.indexOf("|" + key + "|") < 0) {
				var value = map.get(key);
				if (value !== undefined) {
					map.set(key, ++value);
				}
				else {
					map.set(key, 1);
				}
			}
		});
	};

	return module;
};