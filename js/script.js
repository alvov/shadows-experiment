navigator.getUserMedia  = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
window.requestAnimFrame = ( function(){
	return  window.requestAnimationFrame   ||
		window.webkitRequestAnimationFrame ||
		window.mozRequestAnimationFrame    ||
		window.oRequestAnimationFrame      ||
		window.msRequestAnimationFrame     ||
		function( callback ){
			window.setTimeout(callback, 1000 / 60);
		};
} )();

( function(){

	var video = document.querySelector( 'video' ),
		shadowBox = document.querySelector( '.shadow-box' ),
		canvasVideoSource = document.getElementById( 'video-replica' ),
		canvasWidth,
		canvasHeight,
		contextVideoSource = canvasVideoSource.getContext('2d'),
		
		canvasLightMap = document.getElementById( 'light-map' ),
		contextLightMap = canvasLightMap.getContext('2d'),
		
		canvasSpots = document.getElementById( 'spots' ),
		contextSpots = canvasSpots.getContext('2d'),

		LUMINOSITY_THRESHOLD = 160,
		CELL_SIZE = [10, 10];

	// window.addEventListener( 'devicelight', function( e ){
	// 	console.log( 'devicelight ', e.value );
	// } );
	// window.addEventListener( 'lightlevel', function( e ){
	// 	console.log( 'lightlevel ', e.value );
	// } );

	canvasWidth = canvasVideoSource.width = video.width;
	canvasHeight = canvasVideoSource.height = video.height;

	canvasLightMap.width = video.width;
	canvasLightMap.height = video.height;

	canvasSpots.width = video.width;
	canvasSpots.height = video.height;

	var dropShadow = function () {
		var MAX_VALUE = 50,
			shadowColors = [randColor()];
		// Forms and paints shadows based on lightspots
		return function( lightSpots ) {
			var shadows = [{
					x: 0,
					y: 0,
					blur: 30,
					offset: 5,
					color: shadowColors[0]
				}],
				shadowStyle = [],
				i, l;
			// build shadows objects
			for ( i = 0, l = lightSpots.length; i < l; i++ ) {
				shadows[i] = {};
				shadows[i].x = MAX_VALUE * ( 0.5 - lightSpots[i].coords[0] / canvasLightMap.width ); 
				shadows[i].y = MAX_VALUE * ( 0.5 - lightSpots[i].coords[1] / canvasLightMap.height ); 
				shadows[i].blur = MAX_VALUE * ( lightSpots[i].luminosity / 255 );
				shadows[i].offset = MAX_VALUE * lightSpots[i].square / ( canvasLightMap.width * canvasLightMap.height );
				if ( shadowColors.length <= i ) {
					shadowColors.push( randColor() );
				}
				shadows[i].color = shadowColors[i];
			}
			// build style values
			for ( i = 0, l = shadows.length; i < l; i++ ) {
				shadowStyle.push( [shadows[i].x + 'px', shadows[i].y + 'px', shadows[i].blur + 'px', shadows[i].offset + 'px', shadows[i].color].join( ' ' ) );
			}
			shadowBox.style.boxShadow = shadowStyle.join( ', ' );
		}
	}();

	// Captures video from camera and outputs stream to <video> element
	navigator.getUserMedia( { 
			video: true
		}, function( stream ){
			video.src = window.URL.createObjectURL( stream );
			setTimeout( updateLightMap, 2000 );
		}, function( err ){
			// console.log( 'stream error' );
		}
	);

	// Returns random value between 0 and 255
	function randLightness(){
		return Math.round( Math.random() * 255 );
	}
	
	// Returns random rgba color value
	function randColor(){
		return 'rgba(' + ( [randLightness(), randLightness(), randLightness() ].join( ',' ) ) + ',0.9)';
	}

	// Returns median value of numeric array
	function getMedianValue( arr ) {
		arr.sort( function( a, b ){
			return a - b;
		} );
		return arr[Math.floor( arr.length / 2 )];
	};

	// Returns the luminosity of a pixel
	function getPixelLightness( data, dataWidth, x, y ){
		var luminosity = 0,
			i = y * dataWidth * 4 + x * 4,
			l = i + 3;
		for ( ; i < l; i++ ) {
			luminosity += data[i];
		}
		return Math.round( luminosity / 3 );
	};

	// Returns the luminosity of a rectangular area
	function getRectLightness( data, dataWidth, x, y, width, height ) {
		var luminosity = [],
			i = 0,
			j;
		for ( ; i < height; i++ ) {
			for ( j = 0; j < width; j++ ) {
				luminosity.push( getPixelLightness( data, dataWidth, x + j, y + i ) );
			}
		}
		return getMedianValue( luminosity );
	};

	// Returns true if two pixels are neighbours
	function areNeighbours( coords1, coords2 ){
		var result = false;
		if ( coords1[0] === coords2[0] ) {
			if ( Math.abs( coords1[1] - coords2[1] ) < ( CELL_SIZE[1] * 1.5 ) ) {
				result = true;
			}
		} else if ( coords1[1] === coords2[1] ) {
			if ( Math.abs( coords1[0] - coords2[0] ) < ( CELL_SIZE[0] * 1.5 ) ) {
				result = true;
			}
		}
		return result;
	};

	// Returns array of neighbour cells to a given cell
	function findNeighbours( cell, cells ) {
		var hash,
			neighbour,
			neighbours = [];
		for ( hash in cells ) {
			if ( cells.hasOwnProperty( hash ) && 
				areNeighbours( cell.coords, cells[hash].coords ) ) {
					neighbour = cells[hash];
					delete cells[hash];
					neighbours.push( neighbour );
					neighbours = neighbours.concat( findNeighbours( neighbour, cells ) );
			}
		}
		return neighbours;
	}

	// Returns neighbour cells of a given cell
	function getLightSpots( cells ) {
		var spots = [],
			spotCells = [],
			hash,
			otherHash,
			neighboursCount;
		for ( hash in cells ) {
			if ( cells.hasOwnProperty( hash ) ) {
				spotCells = [cells[hash]];
				delete cells[hash];
				spotCells = spotCells.concat( findNeighbours( spotCells[0], cells ) );
				spots.push( spotCells );
			}
		}
		return spots;
	};

	// Prints luminosity map to the canvas
	function updateLightMap(){
		var sourceData,
			lightCells,
			lightSpots,
			reducedLightSources;

		// stream video to the canvas
		contextVideoSource.drawImage( video, 0, 0, video.width, video.height );
		// get pixel data from video
		sourceData = contextVideoSource.getImageData( 0, 0, canvasWidth, canvasHeight );

		// output luminosity map to another canvas and find the brightest cells
		lightCells = ( function getLightCells(){
			var lightCells = [],
				rowCell, colCell,
				cellLightness,
				coords;
			for ( rowCell = 0; rowCell < canvasHeight; rowCell += CELL_SIZE[1] ) {
				for ( colCell = 0; colCell < canvasWidth; colCell += CELL_SIZE[0] ) {
					cellLightness = getRectLightness( sourceData.data, sourceData.width, colCell, rowCell, CELL_SIZE[0], CELL_SIZE[1] );
					contextLightMap.fillStyle = 'rgb(' + [cellLightness, cellLightness, cellLightness].join() + ')';
					contextLightMap.fillRect( colCell, rowCell, CELL_SIZE[0], CELL_SIZE[1] );
					if ( cellLightness >= LUMINOSITY_THRESHOLD ) {
						coords = [colCell, rowCell];
						lightCells[coords.join()] = {
							coords: coords.slice(),
							luminosity: cellLightness
						};
					}
				}
			}
			return lightCells;
		} )();

		// output brightest cells to yet another canvas
		( function paintBrightCells(){
			var hash;
			contextSpots.fillStyle = 'rgb(0,0,0)';
			contextSpots.fillRect( 0, 0, canvasWidth, canvasHeight );
			for ( hash in lightCells ) {
				if ( lightCells.hasOwnProperty( hash ) ) {
					contextSpots.fillStyle = 'rgb(' + [lightCells[hash].luminosity, lightCells[hash].luminosity, lightCells[hash].luminosity].join() + ')';
					contextSpots.fillRect( lightCells[hash].coords[0], lightCells[hash].coords[1], CELL_SIZE[0], CELL_SIZE[1] );
				}
			}
		} )();

		// get groups of light spots from brightest cells
		lightSpots = getLightSpots( lightCells );

		// reduce groups into points
		reducedLightSources = ( function reduceLightSources(){
			var reducedLightSources = [],
				spotLightness,
				minX, maxX, minY, maxY,
				i = 0, l = lightSpots.length,
				j, k;
			for ( ; i < l; i++ ) {
				spotLightness = 0;
				minX = Infinity; maxX = 0;
				minY = Infinity; maxY = 0;
				for ( j = 0, k = lightSpots[i].length; j < k; j++ ) {
					spotLightness += lightSpots[i][j].luminosity;
					minX = Math.min( minX, lightSpots[i][j].coords[0] );
					maxX = Math.max( maxX, lightSpots[i][j].coords[0] );
					minY = Math.min( minY, lightSpots[i][j].coords[1] );
					maxY = Math.max( maxY, lightSpots[i][j].coords[1] );
				}
				spotLightness /= k;
				reducedLightSources.push( {
					coords: [
						( maxX + minX ) / 2,
						( maxY + minY ) / 2
					],
					luminosity: spotLightness,
					square: ( maxX - minX + CELL_SIZE[0] ) * ( maxY - minY + CELL_SIZE[1] )
				} );
			}
			return reducedLightSources;
		} )();

		// draw css shadows
		dropShadow( reducedLightSources );
	
		// ...aaaand loop back
		requestAnimationFrame( updateLightMap );
	};

} )();