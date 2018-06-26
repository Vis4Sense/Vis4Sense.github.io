/**
 * Created by gphillips on 15/06/2016.
 */

sm.misc.trustFilter = function () {

	// Filter selection event dispatcher
	var dispatch = d3.dispatch("trustfilterchanged");

	// Filter state
	var filter = d3.set([]);

	/**
	 * Main entry point, constructs the pane, title and content.
	 */
	function module() {

		var RATING_LEVEL = sm.misc.trustMetrics().RATING_LEVELS();
		var DATA = [
			{
				id: "trust-filter-low",
				label: "Low",
				value: RATING_LEVEL.LOW,
				opacity: 0.2
			},
			{
				id: "trust-filter-medium",
				label: "Medium",
				value: RATING_LEVEL.MEDIUM,
				opacity: 0.5
			},
			{
				id: "trust-filter-high",
				label: "High",
				value: RATING_LEVEL.HIGH,
				opacity: 1.0
			}
		];

		// Enable everything in the filter by default
		DATA.forEach(function(d) {
			filter.add(d.value);
		});

		$("section.trust-filter").replaceWith("<section class='trust-filter'></section>");
		$("section.trust-filter")
			.append('<div class="themes-header">Trust Filter</div>');

		// Add the filter controls

		var label = d3.select(".trust-filter").selectAll("label")
			.data(DATA)
			.enter()
			.append("label")
				.attr("class", "checkbox-inline")
				.append("input")
					.attr("type", "checkbox")
					.property("checked", function(d) {
						return filter.has(d.value);
					})
					.on("click", function(d) {
						if (this.checked) {
							filter.add(d.value);
						}
						else {
							filter.remove(d.value);
						}
						dispatch.trustfilterchanged(filter);
					});

		d3.select(".trust-filter").selectAll("label")
			.append("span")
				.style("opacity", function(d) {
					return d.opacity;
				})
				.text(function(d) {
					return d.label;
				});

	}

	/**
	 * Returns the filter state.
	 */
	module.filter = function() {
		return filter;
	};

	// Bind custom events
	d3.rebind(module, dispatch, "on");

	return module;
};