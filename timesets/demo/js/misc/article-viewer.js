/**
 * ARTICLE-VIEWER module provides a simple dialog that show the article.
 */
sm.misc.articleViewer = function() {
    var width = 400,
        height = 250;

    /**
     * Main entry of the module.
     */
    function module(selection) {
        selection.each(function(d) {
            if (d.length > 0) {
                // Dialog
                var container = $("<div></div>").appendTo(this);
                container.attr("title", d.dialogTitle)
                   .dialog({
                       width: width * 2,
                       maxHeight: height * 2,
                       show: {effect: 'fade', duration: sm.TRANSITION_SHOW_HIDE},
                       hide: {effect: 'fade', duration: sm.TRANSITION_SHOW_HIDE}
                    });

                d.forEach(function(article, i) {
                    // Title
                    $("<div class='sm-articleViewer-title'></div>").appendTo(container).html(article.originalTitle);

                    // Time
                    var timeText = d3.time.format("%d-%m-%Y")(article.time);
                    if (article.endTime) {
                        timeText += " -- " + d3.time.format("%d-%m-%Y")(article.endTime);
                    }
                    $("<div class='sm-articleViewer-time'></div>").appendTo(container).html(timeText);

                    // Content
                    $("<div class='sm-articleViewer-content'></div>").appendTo(container).html(article.content);

                    if (i !== d.length - 1) {
                        $("<br/><br/>").appendTo(container);
                    }
                });
            } else {
            	// Dialog
            	var container = $("<div></div>").appendTo(this);
                var timeText = d3.time.format("%d-%m-%Y")(d.time);
                if (d.endTime) {
                    timeText += " -- " + d3.time.format("%d-%m-%Y")(d.endTime);
                }
            	container.attr("title", timeText)
            	   .dialog({
            	       width: width,
            	       maxHeight: height * 2,
            	       position: [d.x - width + 10, d.y - 15],
            	       show: {effect: 'fade', duration: sm.TRANSITION_SHOW_HIDE},
                       hide: {effect: 'fade', duration: sm.TRANSITION_SHOW_HIDE}
            		});

                // Title
                $("<div class='sm-articleViewer-title'></div>").appendTo(container).html(d.originalTitle);

                // Content
                $("<div class='sm-articleViewer-content'></div>").appendTo(container).html(d.content);
            }
        });
	}

   	return module;
};