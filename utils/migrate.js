module.exports = {
    config: {
        defaultArcGisServers: (value) => {
            return value &&
                value.length === 2 &&
                value[0].url &&
                value[0].url.toLowerCase() === 'http://maps.who.int/arcgis/rest/services/Basemap/WHO_West_Africa_background_7/MapServer'.toLowerCase() &&
                value[1].url &&
                value[1].url.toLowerCase() === 'http://maps.who.int/arcgis/rest/services/Basemap/WHO_Reference_layer/MapServer'.toLowerCase() ?
                [
                    {
                        "name": "WHO Polygon Basemap",
                        "url": "https://tiles.arcgis.com/tiles/5T5nSi527N4F7luB/arcgis/rest/services/WHO_Polygon_Basemap_no_labels/VectorTileServer",
                        "type": "LNG_REFERENCE_DATA_OUTBREAK_MAP_SERVER_TYPE_VECTOR_TILE_VECTOR_TILE_LAYER",
                        "styleUrl": "https://tiles.arcgis.com/tiles/5T5nSi527N4F7luB/arcgis/rest/services/WHO_Polygon_Basemap_no_labels/VectorTileServer/resources/styles/",
                        "styleUrlSource": "esri"
                    },
                    {
                        "name": "Disputed Areas and Borders for Polygon Basemap",
                        "url": "https://tiles.arcgis.com/tiles/5T5nSi527N4F7luB/arcgis/rest/services/WHO_Polygon_Basemap_Disputed_Areas_and_Borders_VTP/VectorTileServer",
                        "type": "LNG_REFERENCE_DATA_OUTBREAK_MAP_SERVER_TYPE_VECTOR_TILE_VECTOR_TILE_LAYER",
                        "styleUrl": "https://tiles.arcgis.com/tiles/5T5nSi527N4F7luB/arcgis/rest/services/WHO_Polygon_Basemap_Disputed_Areas_and_Borders_VTP/VectorTileServer/resources/styles/",
                        "styleUrlSource": "esri"
                    },
                    {
                        "name": "Labels",
                        "url": "https://tiles.arcgis.com/tiles/5T5nSi527N4F7luB/arcgis/rest/services/WHO_Polygon_Basemap_labels/VectorTileServer",
                        "type": "LNG_REFERENCE_DATA_OUTBREAK_MAP_SERVER_TYPE_VECTOR_TILE_VECTOR_TILE_LAYER",
                        "styleUrl": "https://tiles.arcgis.com/tiles/5T5nSi527N4F7luB/arcgis/rest/services/WHO_Polygon_Basemap_labels/VectorTileServer/resources/styles/",
                        "styleUrlSource": "esri"
                    }
                ] :
                value;
        }
    }
}
