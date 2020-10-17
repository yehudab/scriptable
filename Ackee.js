// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: teal; icon-glyph: chart-bar;
const ACKEE_KEY = Keychain.get("ACKEE_KEY")

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

async function getAckeeStats() {
  const url = 'https://ackee.yehudab.com/api'
  const r = new Request(url)
  r.headers = headers
  r.body = JSON.stringify(body)
  r.method = "post"
  const result = await r.loadJSON()
  return result
}

function getGraph(stats) {
  let dc = new DrawContext()
  const height = 150
  const width = 200
  const leftPad = 20
  const drawWidth = width - leftPad
  const barWidth = drawWidth/stats.length - 2
  const barColor = new Color('#6e7373')
  const lastBarColor = new Color('#73fac8')
  dc.respectScreenScale = true
  dc.opaque = false
  dc.size = new Size(width, height)
  const maxDaily = stats.reduce((x, m) => x >= m ? x : m, 0)
  const lines = [0, 10, 20]
  const yScale = (height-20)/lines[2]
  
  dc.setLineWidth(1)
  
  dc.setFont(new Font('HelveticaNeue', 12))
  lines.forEach(l => {
    let p = new Path()
    p.move(new Point(0, height-l*yScale))
    p.addLine(new Point(width, height-l*yScale))
    dc.addPath(p)
    dc.setStrokeColor(barColor)
    dc.strokePath()
    dc.setTextColor(barColor)
    console.log(`${l}: new Point(0, ${height-l*yScale-20})`)
    dc.drawText(`${l}`, new Point(0, height-l*yScale-20))
  });
  
  stats.forEach((v, i) => {
    dc.setFillColor(i === stats.length-1 ? lastBarColor : barColor)
    const x = leftPad + drawWidth * i / stats.length
    const barHeight = Math.max(v*yScale, 4)
    const y = height - barHeight
    dc.fillRect(new Rect(x, y, barWidth, barHeight))
  });
  
  const image = dc.getImage()
//   dc.endDrawing()
  
  return image
}

const stats = await getAckeeStats()
const last7Days = stats.data.domains[0].statistics.views.slice(0,7).reverse().map(s => s.count)

const graph = getGraph(last7Days)
let w = new ListWidget()
w.backgroundColor = new Color('#333838')
let titleTxt = w.addText('yehudab.com')
w.addSpacer(10)
let graphWidgetImage = w.addImage(graph)
if (!config.runsInWidget) {
 await w.presentSmall()
}

// Tell the system to show the widget.
Script.setWidget(w)
Script.complete()
