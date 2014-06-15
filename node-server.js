var sys = require( 'sys' ),
	curHttp = require( 'http' ),
	path = require( 'path' ),
	url = require( 'url' ),
	filesys = require( 'fs' ),
	PORT = 8080;

curHttp.createServer( function( request, response ){
    var curPath = url.parse( request.url ).pathname;
    loadFile( curPath, response );
} ).listen( PORT );  
sys.puts( 'Server Running on ' + PORT );

function loadFile( curPath, response ){
	fullPath = path.join( process.cwd(), curPath );
	path.exists( fullPath, function( exists ){
		if ( !exists ) {
			response.writeHeader( 404, { 'Content-Type': 'text/plain' } );    
            response.write( '404 Not Found\n' );
            response.end();
		} else {
			filesys.readFile( fullPath, 'binary', function( err, file ) {    
                 if ( err ) {
                    response.writeHeader( 500, { 'Content-Type': 'text/plain' } );    
                    response.write( err + '\n' );
                    response.end();    
				} else{  
                    response.writeHeader( 200 );    
                    response.write( file, 'binary' );    
                    response.end();  
                }  
            } );
		}
	} );
}