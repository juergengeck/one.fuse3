console.log('Starting FUSE3 module test...');

try {
    console.log('Loading module...');
    const fuse = require('./build/Release/fuse3_napi.node');
    console.log('Module loaded successfully!');
    console.log('Available exports:', Object.keys(fuse));
    
    // Check if the Fuse3 class is available
    if (fuse.Fuse3) {
        console.log('Fuse3 class is available');
    }
    
    // Check error constants
    console.log('Error constants:');
    console.log('  ENOENT:', fuse.ENOENT);
    console.log('  EACCES:', fuse.EACCES);
    console.log('  EIO:', fuse.EIO);
    
} catch (error) {
    console.error('Failed to load module:', error);
    console.error('Stack:', error.stack);
}

console.log('Test completed.');