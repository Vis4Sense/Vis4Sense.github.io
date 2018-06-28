/**
 * Created by gphillips on 06/06/2016.
 */

// SVG text placement varies across rendering engines.
var timesetsProperties = {
	platform: "",
	eventText_dy: "0",
	eventSelectionTimeText_dy: ".71em",
	wordCloudText_dx: 0,
	wordCloudText_dy: 0
};

// A not very sophisticated browser detection block...
if (navigator.platform === "iPad") {
	// Apple iPad
	timesetsProperties.platform = "iPad";
	timesetsProperties.eventText_dy = "0";
	timesetsProperties.eventSelectionTimeText_dy = ".1em";
	timesetsProperties.wordCloudText_dx = -20;
	timesetsProperties.wordCloudText_dy = 0;
}
else if (navigator.userAgent.indexOf("Chrome") >= 0) {
	// Google Chrome
	timesetsProperties.platform = "Chrome";
	timesetsProperties.eventText_dy = ".67em";
	timesetsProperties.eventSelectionTimeText_dy = ".85em";
	timesetsProperties.wordCloudText_dx = -15;
	timesetsProperties.wordCloudText_dy = 10;
}
else {
	// Microsoft Internet Explorer & others
	timesetsProperties.platform = "IE";
	timesetsProperties.eventText_dy = ".32em";
	timesetsProperties.eventSelectionTimeText_dy = ".5em";
	timesetsProperties.wordCloudText_dx = -20;
	timesetsProperties.wordCloudText_dy = 7;
}
