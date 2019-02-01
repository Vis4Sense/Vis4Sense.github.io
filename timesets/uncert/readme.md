# Load from Google Spread Sheet

## Setup 

### Install HTTP Server (optional)
`$: npm install http-server -g`

### Run HTTP Server (optional)
`$: http-server -p 8083`

### Open
Nagivate in your browser to the following URL `http://localhost:8083/sandbox.html` or click [here](http://localhost:8083/sandbox.html)


## Data Model

We provide a template spreadsheet where you can plug-in your own data to display in the TimeSets.

https://docs.google.com/spreadsheets/d/1SwIizq1WMnpE9xdeWHuD5PoOnyVRcxsfAQtgdw92S84/edit?usp=sharing

### Data structure
The spreadsheet is seperated into different sections. We go over the sections and provide an explanation and example of values the properties can have.
Please ensure the names of the colunms are thesame as the below "data" and "themes"
### data

| -| - |
|----------------------|---|
| ID       | Number (Integer) - The objects identifier  |
| data_type          | Text - The data type of the object, __e.g., ''__  |
| name           | Text - The objects title, __e.g., ''__ |
| description | Text - A textual description of the object |
| picture      | URL - The URL to the image, video, media resource, __e.g., ''__ |
| from      | URL - The URL to the source of the event, __e.g., ''__ |
| comments      | Text - The users comments for the object  |

### Temporal Data (bright range cells)

| -| - |
|----------------------|---|
| created_time        | Defines the temporal interval where the object is valid. The first argument is the start date and the second argument is the end date. If no end date is provided we assume its ongoing for Network and point in time for Geo and Sets, __e.g., 2013-12-31T12:34:56 - 2014-12-31T12:34:56__  |
| Rating              | Category (mostly true, no factual content, mixture of true and false, mostly false) (String)   


### themes

| -| - |
|----------------------|---|
| theme                | Text - The theme to be identified in the data  |


### Loading Data into TimeSets

Export the Spreadsheet by clicking file -> publish to web -> entire documents -> publish

goto share -> copylink e.g. https://docs.google.com/spreadsheets/d/1SwIizq1WMnpE9xdeWHuD5PoOnyVRcxsfAQtgdw92S84/edit?usp=sharing

Append the url to the end of http://vis4sense.github.io/timesets/uncert/ with ?url='copied_url' e.g. 
http://vis4sense.github.io/timesets/uncert/?url=https://docs.google.com/spreadsheets/d/1SwIizq1WMnpE9xdeWHuD5PoOnyVRcxsfAQtgdw92S84/edit?usp=sharing
