/**
 * ARTICLE-VIEWER module provides a simple dialog that show the article.
 */
sm.misc.articleViewer = function(title) {

    var aside = $("aside");

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(d) {

			$("li.event-viewer .detail-pane").remove();

			var pane = $("<div class='detail-pane'></div>");

			pane.css('margin-left',aside.width()+'px');

				pane.appendTo($("li.event-viewer"))
				.append($("<div class='detail-pane-title'>Event</div>"));
			var container = $("<article></article>").appendTo(pane);

			// If item is a single article then put it into an array of length 1
			var articles;

			if (d.length === undefined) {
				articles = [d];
			}
			else {
				articles = d;
			}

			articles.forEach(function(article, i) {

				// Image
				if (article.sourceImageUrl !== undefined) {
					// container.append("<img class='sm-articleViewer-sourceimage' src='data/img/" + article.sourceImageUrl + "' />");
					container.append("<img class='sm-articleViewer-sourceimage' src='" + article.sourceImageUrl + "' />");
				}
				// Title
				$("<div class='sm-articleViewer-title'></div>").appendTo(container).html(article.originalTitle);

				// Content
				$("<div class='sm-articleViewer-content'></div>").appendTo(container).html(article.content);

				// Time
				var timeText = d3.time.format("%d-%m-%Y")(article.time);
				if (article.endTime) {
					timeText += " -- " + d3.time.format("%d-%m-%Y")(article.endTime);
				}
				$("<div class='sm-articleViewer-time'></div>").appendTo(container).html(timeText);

				//SHARE COUNT
				if(article.shareCount){
                    $("<div class='sm-articleViewer-time'></div>").appendTo(container).html("Shares: " + article.shareCount);
                }

                //AVERAGE SOURCE RATING
                if(article.sourceAvgRating){
                    $("<div class='sm-articleViewer-time'></div>").appendTo(container).html('Source: ' + article.source + ", Average Rating: " + sm.reverseRating(article.sourceAvgRating));
                }

				// Article separator, if not the last article
				if (i !== articles.length - 1) {
					container.append("<div class='sm-articleViewer-separator'></div>");
				}
			});
        });
	}

   	return module;
};