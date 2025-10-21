// variables.js

/** Variables
 * @namespace
 * @memberOf module:heiImageViewer
 * @readonly
 * @enum {String}
 */
const variables = {
    /** Default color for a feature without specified color. */
    "COLOR_DEFAULT": [160,0,0],
    /** Annotation type used for DWork annotation. Has zIndex 104. */
    "FEATURE_TYPE_ANNO": "annotation",
    /** Annotation type used for a custom annotation. Has zIndex 105. */
    "FEATURE_TYPE_CUSTOM": "custom",
    /** Annotation type used for a line of text on a written zone. Especially for text-image alignment purposes. Has zIndex 102. */
    "FEATURE_TYPE_LINE": "line",
    /** Annotation type used for a search snippet. Especially for text-image alignment purposes. Has zIndex 103. */
    "FEATURE_TYPE_SEARCH": "search",
    /** Annotation type used for a zone on a surface. Usually to include lines. Especially for text-image alignment purposes. Has zIndex 101. */
    "FEATURE_TYPE_ZONE": "zone",
    /** The default position of the image on the screen, which is 'center', i.e. the center of the image is in the center of the canvas. */
    "POSITION_DEFAULT": "center",
    /** Value of position of the image at the top of the canvas and centered. */
    "POSITION_TOP": "top",
    /* Value of position of the image at the top of the canvas and the left side of the image on the left margin of the canvas. */
    "POSITION_TOP_LEFT": "top-left",
    /** The property of the {@link module:heiImageViewer#imageViewer} object that stores the value of the scroll, zoom or vertical. */
    "PROPERTY_WHEEL": "wheelMode",
    /** The property of the {@link module:heiImageViewer#imageViewer} object that stores the value of the visibility of the zones. */
    "PROPERTY_ZONES": "showZones",
    /** The value property of PROPERTY_WHEEL when it moves vertically. */
    "MW_VERTICAL": "vertical",
    /** The value property of PROPERTY_WHEEL when it zooms. */
    "MW_ZOOM": "zoom",
    /** The value property of PROPERTY_ZONES when all are shown. */
    "ZONES_SHOW_ALL": "always",
    /** The value property of PROPERTY_ZONES when they are only shown on hover. */
    "ZONES_SHOW_DEFAULT": "default",
    /** Value of PROPERTY_ZONES when none are shown. */
    "ZONES_SHOW_NONE": "never",
    /** The smallest dimension (width or height) occupies the whole canvas. */
    "ZOOM_COVER": "cover",
    /** The maximum zoom in which the whole image is visible. */
    "ZOOM_MIN": "min",
};

export default variables;
