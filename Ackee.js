const ACKEE_KEY = Keychain.get("ACKEE_KEY");

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

async function getAckeeStat() {
  const url = 'https://ackee.yehudab.com/api'
  const r = new Request(url)
  r.headers = headers
  r.body = JSON.stringify(body)
  const result = await r.loadJSON()
  return result
}

function getGraph(stats) {
  let dc = new DrawContext()
  const height = 100
  const width = 140
  const barWidth = 140/stats.length - 2
  const barColor = new Color('#6e7373')
  const lastBarColor = new Color('#73fac8')
  dc.respectScreenScale = true
  dc.opaque = false
  dc.size = new Size(width, height)
  const maxDaily = stats.reduce((x, m) => x >= m ? x : m, 0)
  const lines = [0, 10, 20]
  const yScale = (height-20)/lines[2]
  dc.setStrokeColor(barColor)
  dc.setLineWidth(2)
  dc.setFont(new Font('HelveticaNeue', 12))
  lines.forEach(l => {
    let p = new Path()
    p.move(new Point(0, l*yScale))
    p.addLine(new Point(width, l*yScale))
    dc.addPath(p)
    dc.strokePath()
    dc.drawText(l.toString(), new Point(0, l*yScale+20)
  });
  stats.forEach((v, i) => {
    dc.setFillColor(i === stats.length-1 ? lastBarColor : barColor)
    const x = width * i / stats.length
    const y = 0
    const barHeight = Math.max(v*yScale, 4)
    dc.fillRect(new Rect(x, y. barWidth, barHeight))
  });
  
  const image = dc.getImage()
  dc.endDrawing()
  
  return image
}

const stats = await getAckeeStats()
const last7Days = stats.data.domains[0].statistics.views.slice(0,7).reverse().map(s => s.count)
const graph = getGraph(last7Days)
let w = new ListWidget()
w.backgroundColor = new Color('#333838')
let titleTxt = w.addText('yehudab.com')
titleTxt.applyHeadlineTextStyling()
titleTxt.textColor = Color.white()
w.addSpacer(10)
let graphWidgetImage = w.addImage(graph)
