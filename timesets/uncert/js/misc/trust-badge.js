/**
 * Created by gphillips on 27/05/2016.
 */

sm.misc.trustBadge = function () {

	/**
	 * Main entry point, constructs the pane, title and graph.
	 */
	function module(metrics) {

		/**
		 * Returns the trust badge URL from the mean rating
		 * @param metrics
		 * @returns {*}
		 */
		function getIconUrl(metrics) {
			if (metrics.meanRatedLevel >= 2.5) {
				return "img/high.png";
			}
			else if (metrics.meanRatedLevel >= 1.5) {
				return "img/medium.png";
			}
			else if (metrics.meanRatedLevel > 0.0) {
				return "img/low.png";
			}
			return "img/undefined-level.png";
		}

		// Replace the image in the container.
		$(".trust-badge").replaceWith('<div class="trust-badge"></div>');
		$(".trust-badge")
			.append('<img src="' + getIconUrl(metrics) + '" title="Mean trust" />');
	}

	return module;
};