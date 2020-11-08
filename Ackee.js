// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: chart-bar;

// On first run only, uncomment line bellow and replace '888...' with the token returned after login
// Keychain.set("ACKEE_KEY", '88888888-8888-8888-8888-888888888888')

// Ackee configuration
const ACKEE_KEY = Keychain.get("ACKEE_KEY")
const AckeeAPI = 'https://ackee.yehudab.com/api'
const domainName = 'yehudab.com'

// Chart configuration 
const chartHeight = 150
const chartWidth = 200
const leftPad = 20
const barColorHex = '#6e7373'
const lastBarColorHex = '#73fac8'

const query = `query fetchViews($interval: Interval!, $type: ViewType!) {
  domains {
    id
    statistics {
      views(interval: $interval, type: $type) {
        id
        count
      }
    }
  }
}`

const body = {
  "query": query,
  "variables": {
    "interval": "DAILY",
    "type":"UNIQUE"
  }
}

const headers = {
  "authorization": `Bearer ${ACKEE_KEY}`,
  "content-type": "application/json"
}

// Use GraphQL to get number of visits to the site
async function getAckeeStats() {
  const r = new Request(AckeeAPI)
  r.headers = headers
  r.body = JSON.stringify(body)
  r.method = "post"
  const result = await r.loadJSON()
  const last7Days = result.data.domains[0].statistics.views.slice(0, 7).reverse().map(s => s.count)
  return last7Days
}

const bestTicks = [
  [0,1,2],
  [0,1,2],
  [0,1,2],
  [0,2,4],
  [0,2,4],
  [0,3,6],
  [0,3,6],
  [0,4,8],
  [0,4,8],
  [0,5,10],
  [0,5,10]
]

// Rough way to calculate the best series of 0-based tick marks on the y axis
function getBestTicks(maxValue) {
  const maxPow10 = Math.pow(10, Math.ceil(Math.log10(maxValue))-1);
  const normalized = Math.ceil(maxValue/maxPow10)
  if (isNaN(normalized)) {
    return [0, 1, 2]  
  } else {
    return bestTicks[normalized].map(x => x*maxPow10)
  }
}

// Draw bar chart of the given series on a DrawContext and return the image from the DC
function getBarChart(series) {
  let dc = new DrawContext()
  const drawWidth = chartWidth - leftPad
  const barWidth = drawWidth/series.length - 2
  const barColor = new Color(barColorHex)
  const lastBarColor = new Color(lastBarColorHex)
  dc.respectScreenScale = true
  dc.opaque = false
  dc.size = new Size(chartWidth, chartHeight)
  const maxDaily = series.reduce((x, m) => x >= m ? x : m, 0)
  const lines = getBestTicks(maxDaily)
  const yScale = (chartHeight-20)/lines[2]
  
  // draw horizontal lines and values
  dc.setLineWidth(1)
  dc.setFont(new Font('HelveticaNeue', 12))
  lines.forEach(l => {
    let p = new Path()
    p.move(new Point(0, chartHeight-l*yScale))
    p.addLine(new Point(chartWidth, chartHeight-l*yScale))
    dc.addPath(p)
    dc.setStrokeColor(barColor)
    dc.strokePath()
    dc.setTextColor(barColor)
    dc.drawText(`${l}`, new Point(0, chartHeight-l*yScale-20))
  });
  
  // Draw the bars for each day
  series.forEach((v, i) => {
    dc.setFillColor(i === series.length-1 ? lastBarColor : barColor)
    const x = leftPad + drawWidth * i / series.length
    const barHeight = Math.max(v*yScale, 4)
    const y = chartHeight - barHeight
    dc.fillRect(new Rect(x, y, barWidth, barHeight))
  });
  
  const image = dc.getImage()
//   dc.endDrawing()
  
  return image
}

const last7Days = await getAckeeStats()
const graph = getBarChart(last7Days)
let w = new ListWidget()
w.backgroundColor = new Color('#333838')
let titleTxt = w.addText(domainName)
titleTxt.textColor = new Color('#ffffff')
w.addSpacer(10)
let graphWidgetImage = w.addImage(graph)
if (!config.runsInWidget) {
 await w.presentSmall()
}

// Tell the system to show the widget.
Script.setWidget(w)
Script.complete()
