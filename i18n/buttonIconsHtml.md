
buttonIconsHtml
===============

We're defining the button icons as HTML because it's very flexible:
We can use Unicode icons to make a flexible base package, and if you want
SVG or FontAwesome, you can easily install other icons by loading an
icon pack script before you instantiate your first `heiImageViewer`.
The icon pack script would then monkey-patch `heiImageViewer.buttonIconsHtml`.


Unicode icon suggestions
------------------------

Only one icon can be the default, but maybe you prefer some of the alternatives
we found, so here are all the Unicode icons we considered.


### Viewport control

#### centerInViewport

* U+2299 circled dot operator (⊙)
* U+22A1 squared dot operator (⊡)
* U+22B9 hermitian conjugate matrix (⊹)
* U+2316 position indicator (⌖)
* U+25C9 fisheye (◉)
* U+25CE bullseye (◎)
* U+29C8 squared square (⧈)
* U+29FE tiny (⧾)
* U+2A00 n-ary circled dot operator (⨀)
* U+2BD0 square position indicator (⯐)
* U+1F78A white circle containing black small circle (🞊)
* U+1F78B round target (🞋)
* U+1F794 white square containing black very small square (🞔)
* U+1F796 square target (🞖)


#### mouseWheelScrolls

* U+1F5AF one button mouse,
  U+0302 combining circumflex accent,
  U+032C combining caron below (🖯̬̂)
* U+1F5AF one button mouse, U+2195 up down arrow (🖯↕)


#### mouseWheelZooms

* U+1F5AF one button mouse, U+00B0 degree sign (🖯°)
* U+1F5AF one button mouse, U+030A combining ring above (🖯̊)


#### rotateFreely


#### rotateLeft

* U+21B6 anticlockwise top semicircle arrow (↶)
* U+21BA anticlockwise open circle arrow (↺)


#### rotateRight

* U+21B7 clockwise top semicircle arrow (↷)
* U+21BB clockwise open circle arrow (↻)


#### toggleFullScreen

* U+2922 north east and south west arrow (⤢)
* U+1F5D6 maximize (🗖)


#### toggleOverviewMap

* U+25F0 white square with upper left quadrant (◰)
* U+1F441 eye (👁)


#### zoomIn

* U+229E squared plus (⊞)
* U+1F50E right-pointing magnifying glass,
  U+031F combining plus sign below (🔎̟)


#### zoomOut

* U+229F squared minus (⊟)
* U+1F50E right-pointing magnifying glass,
  U+0320 combining minus sign below (🔎̠)


### Shape editing

#### deleteShape

* U+1F5D1 wastebasket (🗑)


#### moveScaleRotate

* U+26F6 square four corners (⛶)


#### editVertices

* U+2058 four dot punctuation (⁘)
* U+2220 angle (∠)
* U+2234 therefore (∴) + U+20E1 combining left right arrow above (⃡)
* U+26EC historic site (⛬)
* U+26EC historic site (⛬) + U+20E1 combining left right arrow above (⃡)
* U+10B3F large one ring over two rings punctuation (𐬿)
* U+1F709 alchemical symbol for aqua vitae-2 (🜉)
* U+1F73A alchemical symbol for arsenic (🜺)


#### selectObject

* U+261D white up pointing index (☝)


### Shapes

#### circle
* U+25CB white circle (○)
* U+25CF black circle (●)
* U+26AB medium black circle (⚫)
* U+25EF large circle (◯)


#### ellipse

* U+2B2D white horizontal ellipse (⬭)
* U+2B2E black vertical ellipse (⬮)
* U+2B2F white vertical ellipse (⬯)


#### line
* U+2758 light vertical bar (❘)


#### polygon

* U+2302 house (⌂)
* U+2394 software-function symbol (⎔)
* U+23E2 white trapezium (⏢)
* U+2B1F black pentagon (⬟)
* U+2B20 white pentagon (⬠)
* U+2B21 white hexagon (⬡)
* U+2B22 black hexagon (⬢)
* U+2B23 horizontal black hexagon (⬣)
* U+2B23 horizontal black hexagon (⬣)
* U+2B53 black right-pointing pentagon (⭓)
* U+2B54 white right-pointing pentagon (⭔)


#### rect

* U+25A1 white square (□)
* U+25AC black rectangle (▬)
* U+25AD white rectangle (▭)











