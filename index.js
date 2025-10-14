/**
 * JavaScript interface for FUSE3 N-API addon
 */

const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

// Try to load the compiled addon
let fuse3_napi;
try {
    // Try different paths where the addon might be
    const possiblePaths = [
        './build/Release/fuse3_napi.node',
        './build/Debug/fuse3_napi.node',
        '../build/Release/fuse3_napi.node',
        '../build/Debug/fuse3_napi.node',
        path.join(__dirname, 'build/Release/fuse3_napi.node'),
        path.join(__dirname, 'build/Debug/fuse3_napi.node')
    ];
    
    for (const addonPath of possiblePaths) {
        try {
            fuse3_napi = require(addonPath);
            console.log(`Loaded FUSE3 N-API addon from: ${addonPath}`);
            break;
        } catch (e) {
            // Try next path
        }
    }
    
    if (!fuse3_napi) {
        throw new Error('Could not find compiled FUSE3 N-API addon');
    }
} catch (err) {
    console.error('Failed to load FUSE3 N-API addon:', err.message);
    console.error('Make sure to run: npm run build');
    throw err;
}

// Export error constants
exports.EPERM = fuse3_napi.EPERM;
exports.ENOENT = fuse3_napi.ENOENT;
exports.EIO = fuse3_napi.EIO;
exports.EACCES = fuse3_napi.EACCES;
exports.EEXIST = fuse3_napi.EEXIST;
exports.ENOTDIR = fuse3_napi.ENOTDIR;
exports.EISDIR = fuse3_napi.EISDIR;
exports.EINVAL = fuse3_napi.EINVAL;
exports.ENOSPC = fuse3_napi.ENOSPC;
exports.EROFS = fuse3_napi.EROFS;
exports.EBUSY = fuse3_napi.EBUSY;
exports.ENOTEMPTY = fuse3_napi.ENOTEMPTY;

/**
 * FUSE3 class - JavaScript wrapper around N-API addon
 */
class Fuse extends EventEmitter {
    constructor(mountPath, operations, options = {}) {
        super();
        
        if (typeof mountPath !== 'string') {
            throw new TypeError('mountPath must be a string');
        }
        
        if (typeof operations !== 'object' || operations === null) {
            throw new TypeError('operations must be an object');
        }
        
        this.mountPath = path.resolve(mountPath);
        this.operations = operations;
        this.options = options;
        this.mounted = false;
        
        // Wrap operations to handle errors properly
        this._wrappedOps = this._wrapOperations(operations);
        
        // Create native FUSE instance
        this._fuse = new fuse3_napi.Fuse3(this.mountPath, this._wrappedOps);
    }
    
    /**
     * Wrap user operations to handle errors and callbacks properly
     */
    _wrapOperations(ops) {
        const wrapped = {};
        
        // Helper to convert error codes
        const errnoToCode = (errno) => {
            if (errno === 0) return 0;
            if (errno > 0) return -errno;
            return errno;
        };
        
        // Wrap each operation
        if (ops.getattr) {
            wrapped.getattr = (path, cb) => {
                try {
                    ops.getattr(path, (err, stats) => {
                        if (err) {
                            cb(errnoToCode(err.errno || err), null);
                        } else {
                            // Convert Date objects to timestamps
                            const stat = {
                                mode: stats.mode || 0,
                                uid: stats.uid || process.getuid(),
                                gid: stats.gid || process.getgid(),
                                size: stats.size || 0,
                                atime: stats.atime ? Math.floor(stats.atime.getTime() / 1000) : Date.now() / 1000,
                                mtime: stats.mtime ? Math.floor(stats.mtime.getTime() / 1000) : Date.now() / 1000,
                                ctime: stats.ctime ? Math.floor(stats.ctime.getTime() / 1000) : Date.now() / 1000
                            };
                            cb(0, stat);
                        }
                    });
                } catch (e) {
                    cb(errnoToCode(e.errno || exports.EIO));
                }
            };
        }
        
        if (ops.readdir) {
            wrapped.readdir = (path, cb) => {
                try {
                    ops.readdir(path, (err, files) => {
                        if (err) {
                            cb(errnoToCode(err.errno || err), []);
                        } else {
                            cb(0, files || []);
                        }
                    });
                } catch (e) {
                    cb(errnoToCode(e.errno || exports.EIO), []);
                }
            };
        }
        
        if (ops.open) {
            wrapped.open = (path, flags, cb) => {
                try {
                    ops.open(path, flags, (err, fd) => {
                        cb(errnoToCode(err ? (err.errno || err) : 0), fd || 0);
                    });
                } catch (e) {
                    cb(errnoToCode(e.errno || exports.EIO), 0);
                }
            };
        }
        
        if (ops.read) {
            wrapped.read = (path, fd, buffer, length, offset, cb) => {
                try {
                    ops.read(path, fd, buffer, length, offset, (err, bytesRead) => {
                        if (err) {
                            cb(errnoToCode(err.errno || err));
                        } else {
                            cb(bytesRead || 0, buffer);
                        }
                    });
                } catch (e) {
                    cb(errnoToCode(e.errno || exports.EIO));
                }
            };
        }
        
        if (ops.write) {
            wrapped.write = (path, fd, buffer, length, offset, cb) => {
                try {
                    ops.write(path, fd, buffer, length, offset, (err, bytesWritten) => {
                        cb(errnoToCode(err ? (err.errno || err) : 0) || bytesWritten || 0);
                    });
                } catch (e) {
                    cb(errnoToCode(e.errno || exports.EIO));
                }
            };
        }
        
        // Add more operation wrappers as needed
        const simpleOps = ['create', 'unlink', 'mkdir', 'rmdir', 'rename', 'chmod', 
                          'chown', 'truncate', 'release', 'fsync', 'flush'];
        
        for (const op of simpleOps) {
            if (ops[op]) {
                wrapped[op] = (...args) => {
                    const cb = args[args.length - 1];
                    try {
                        ops[op](...args.slice(0, -1), (err) => {
                            cb(errnoToCode(err ? (err.errno || err) : 0));
                        });
                    } catch (e) {
                        cb(errnoToCode(e.errno || exports.EIO));
                    }
                };
            }
        }
        
        return wrapped;
    }
    
    /**
     * Mount the filesystem
     */
    mount(callback) {
        if (this.mounted) {
            process.nextTick(callback, new Error('Already mounted'));
            return;
        }
        
        // Ensure mount point exists
        fs.mkdir(this.mountPath, { recursive: true }, (err) => {
            if (err && err.code !== 'EEXIST') {
                return callback(err);
            }
            
            // Mount using N-API addon
            this._fuse.mount((err) => {
                if (err) {
                    callback(new Error(err));
                } else {
                    this.mounted = true;
                    this.emit('mount');
                    callback(null);
                }
            });
        });
    }
    
    /**
     * Unmount the filesystem
     */
    unmount(callback) {
        if (!this.mounted) {
            process.nextTick(callback, new Error('Not mounted'));
            return;
        }
        
        this._fuse.unmount();
        this.mounted = false;
        this.emit('unmount');
        process.nextTick(callback, null);
    }
    
    /**
     * Get mount point
     */
    get mnt() {
        return this.mountPath;
    }
    
    /**
     * Check if mounted
     */
    isMounted() {
        return this._fuse.isMounted();
    }
    
    /**
     * Static unmount method
     */
    static unmount(mountPath, callback) {
        const { exec } = require('child_process');
        exec(`fusermount -u ${mountPath}`, (err) => {
            callback(err);
        });
    }
    
    /**
     * Check if FUSE is configured
     */
    static isConfigured(callback) {
        const { exec } = require('child_process');
        exec('which fusermount3 || which fusermount', (err) => {
            callback(null, !err);
        });
    }
    
    /**
     * Configure FUSE (no-op for Linux)
     */
    static configure(callback) {
        process.nextTick(callback, null);
    }
}

// Export the Fuse class
exports.Fuse = Fuse;

// For compatibility
module.exports = Fuse;
module.exports.Fuse = Fuse;