/**
 * Created by gphillips on 13/05/2016.
 */

sm.misc.trustMatrix = function () {

	var theme = "";
	var trustMetrics = sm.misc.trustMetrics();
	var RATING_LEVEL = trustMetrics.RATING_LEVELS();

	/**
	 * Main entry point, constructs the pane, title and graph.
	 */
	function module(metrics, theme) {

		if (arguments.length >= 2 && theme !== undefined) {
			if (theme === module.theme()) {
				module.theme(""); // metrics apply to all themes
			}
			else {
				module.theme(theme); // metrics apply to this theme only
			}
		}

		$("section.trust-matrix").replaceWith("<section class='trust-matrix'></section>");
		var container = $("section.trust-matrix")
			.append("<div class='themes-header'>Trust Histogram</div>")
			.append('<div class="trust-badge"></div>')
			.append("<div class='trust-matrix-title'>" + (module.theme() === "" ? "All themes" : module.theme()) + "</div>")
			.append("<svg></svg>");

		var svg = d3.select(".trust-matrix svg");

		var margin = { top: 0, right: 0, bottom: 18, left: 18 };
		var graphWidth = svg.node().clientWidth - margin.left - margin.right;
		var graphHeight = svg.node().clientHeight - margin.top - margin.bottom;
		var ROW_GAP = 6;
		var COL_GAP = 6;

		var barMaxHeight = Math.floor(graphHeight / 5 - ROW_GAP);
		var barWidth = Math.floor(graphWidth / 5 - COL_GAP);

		// Create the y axis.
		var yAxisScale = d3.scale.ordinal()
			.domain(["A", "B", "C", "D", "E"])
			.rangePoints([barMaxHeight + ROW_GAP, graphHeight]);

		var yAxis = d3.svg.axis()
			.scale(yAxisScale)
			.orient("left");

		svg.append("g")
			.attr("class", "y axis")
			.attr("transform", "translate(" + margin.left + ", " + (margin.top - 12) + ")")
			.call(yAxis)
			.selectAll("text")
			.attr("dx", "0.2em")
			.style("fill", "#888888");

		// Create the x axis.
		var xAxisScale = d3.scale.ordinal()
			.domain([1, 2, 3, 4, 5])
			.rangeBands([0, graphWidth]);

		var xAxis = d3.svg.axis()
			.scale(xAxisScale)
			.orient("bottom");

		svg.append("g")
			.attr("class", "x axis")
			.attr("transform", "translate(" + margin.left + ", " + (margin.top + graphHeight) + ")")
			.call(xAxis)
			.selectAll("text")
			.attr("class", "text")
			.attr("dx", "-0.35em")
			.attr("y", "0.5ex")
			.style("text-anchor", "middle")
			.style("fill", "#888888");

		var graph = svg.append("g")
			.attr("class", "graph")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")");

		// Create bars in a 5x5 arrangement
		var bar = graph.selectAll("g")
			.data(metrics.counts)
			.enter()
			.append("g")
			.attr("transform", function(d, i) {
				return "translate(" + ((i % 5) * (barWidth + COL_GAP)) + ", " + (Math.floor(i / 5) * (barMaxHeight + ROW_GAP)) + ")";
			});

		var barScale = d3.scale.linear()
			.range([0, barMaxHeight]);

		bar.append("rect")
			.attr("width", barWidth)
			.attr("height", function(d) {
				return 1 + (metrics.ratedCount > 0
						? barScale(d / metrics.ratedCount)
						: 0);
			})
			.attr("y", function(d) {
				return barMaxHeight - (1 + (metrics.ratedCount > 0
						? barScale(d / metrics.ratedCount)
						: 0));
			})
			.style("fill", function(d, i) {
				if (d == 0) {
					return "#dddddd";
				}
				switch (trustMetrics.getRatingLevelByIndex(i)) {
					case RATING_LEVEL.HIGH:
						return "#01a64b";

					case RATING_LEVEL.MEDIUM:
						return "#f5a623";

					case RATING_LEVEL.LOW:
						return "#d0021a";

					default:
						return "black";
				}
			});

		// Bar counts
		bar.append("text")
			.text(function(d) {
				return (d > 0) ? d : "";
			})
			.attr("class", "bar-count")
			.attr("x", function(d) {
				return barWidth / 2 - (d.toString().length / 2) * 5;
			})
			.attr("y", function(d) {
				return barMaxHeight - (1 + (metrics.ratedCount > 0
						? barScale(d / metrics.ratedCount)
						: 0));
			});

		// Add test/debug stats to tooltip.
		var s = "Rated items: " + metrics.ratedCount
			+ "    Mean trust of rated items: " + metrics.meanRatedLevel.toFixed(2)
			+ "    Unrated items: " + metrics.unratedCount;
		container.attr("title", s);
	}

	/**
	 * Theme text property.
	 */
	module.theme = function(value) {
		if (!arguments.length) return theme;
		theme = value;
	};

	return module;
};