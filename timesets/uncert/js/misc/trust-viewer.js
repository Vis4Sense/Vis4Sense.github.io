/**
 * Created by gphillips on 09/05/2016.
 */

sm.misc.trustViewer = function () {

    /*
    Main entry point, constructs a pane.
     */
    function module(selection) {
        selection.each(function(d) {
            $("li.trust-viewer .detail-pane").remove();

            var pane = $("<div class='detail-pane'></div>").appendTo($("li.trust-viewer"))
                .append($("<div class='detail-pane-title'>Trust</div>"));
            var container = $("<article></article>").appendTo(pane);

            var metrics = sm.misc.trustMetrics();
            var rating = "";
            if (d.length === undefined) {
                // Single item
                rating = d.confidence;
            }
            else {
                // Multiple items
                var cumulativeRank = 0;
                var ratedCount = 0;
                d.forEach(function(item) {
                    var trust = metrics.trust(item.confidence);

                    if (trust) {
                        ratedCount++;
                        cumulativeRank += trust.rank;
                    }
                });

                if (ratedCount > 0) {
                    var rank = Math.ceil(cumulativeRank / ratedCount); // pessimistic rounding
                    rating = metrics.RANK_RATINGS()[rank - 1];
                }
            }

            // Trust image
            var iconUrl = getIconUrl(rating);

            function getIconUrl(rating) {
                var trust = metrics.trust(rating);

                if (trust) {
                    switch (trust.level) {
                        case metrics.RATING_LEVELS().LOW:
                            return "img/low.png";

                        case metrics.RATING_LEVELS().MEDIUM:
                            return "img/medium.png";

                        case metrics.RATING_LEVELS().HIGH:
                            return "img/high.png";
                    }
                }

                return "img/undefined-level.png";
            }

            var iconContainer = $("<div class='sm-trustViewer-icon-container'></div>").appendTo(container);
            iconContainer.append("<img class='sm-trustViewer-sourceimage' src='" + iconUrl + "' />");

            // Trust label
			var ratingText = "";
			if (rating) {
				ratingText = (d.length) ? "(" + rating + ")" : rating;
			}
            iconContainer.append("<div id='trust-rating' class='sm-trustViewer-rating'>" + ratingText + "</div>");

            if ((d.length === undefined) && rating) {
                // Trust overrides
                $('<div class="sm-trustViewer-override"></div>')
                    .append("<span>Uncertainty</span>")
                    .append('<input id="uncertainty-range" type="range" min="1" max="5" value="' + rating.substr(1, 1) + '" />')
                    //.append('<input id="ex19" type="range" data-provide="slider" data-slider-ticks="[1, 2, 3]" data-slider-ticks-labels=' + "'['short', 'medium', 'long']'" + "data-slider-min='1' data-slider-max='3' data-slider-step='1' data-slider-value='3' data-slider-tooltip='hide' value=" + rating.substr(1, 1) + '" />')
                    .appendTo(container);

                $("#uncertainty-range")
                    .data("d", d)
                    .on("input", function() {
                        var control = $("#uncertainty-range");
                        var d = control.data("d");
                        var newRating = d.confidence.substr(0, 1) + control.val();
                        d.confidence = newRating;

                        // Update image
                        $(".sm-trustViewer-sourceimage").attr("src", getIconUrl(newRating));

                        // Update label
                        $("#trust-rating").html(newRating);
                    });
            }
        });
    }

    return module;
};