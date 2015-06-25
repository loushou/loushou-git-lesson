QS.Features = QS.Features || { support:{} };
( function( $, F, W, D ) {
	var has = 'hasOwnProperty', qt = QS.Tools;

	F.idb = ( F._idb = function() {
		W.indexedDB = W.indexedDB || W.webkitIndexedDB || W.mozIndexedDB || W.msIndexedDB;
		W.IDBTransaction = W.IDBTransaction || W.webkitIDBTransaction || W.msIDBTransaction;
		W.IDBKeyRange = W.IDBKeyRange || W.webkitIDBKeyRange || W.msIDBKeyRange;
		return qt.is( W.indexedDB );
	} )();

	var local_storage = function( o ) {
		this.o = $.extend( { prefix:'qs-' }, o );

		this.get_data = function( name ) {
			return W.localStorage.getItem( this.o.prefix + name );
		};

		this.set_data = function( name, value ) {
			W.localStorage.setItem( this.o.prefix + name, value );
			return this;
		};

		this.remove_data = function( name ) {
			W.localStorage.removeItem( this.o.prefix + name );
			return this;
		};
	};

	var non_local_storage = function( o ) {
		this.o = $.extend( { prefix:'qs-' }, o );

		this.get_data = function( name ) {
			return '';
		};

		this.set_data = function( name, value ) {
			return this;
		};

		this.remove_data = function( name ) {
			return this;
		};
	};

	QS.timed_cues = function() {
		this.cues = {};

		this.add_cue = function( cue_name, func, every ) {
			var me = this;
			( function( cue_name, func, every ) {
				me.cues[ cue_name ] = {
					id: cue_name,
					func: func,
					every: every
				};
				setInterval( function() { me.cues[ cue_name ].func(); }, me.cues[ cue_name ].every );
			} )( cue_name, func, every );
		};

		this.trigger_cue = function( cur_name ) {
			if ( ! this.cues[ cue_name ] ) return;

			this.cues[ cue_name ].func();
			this.reset_cue( cue_name );
		};

		this.reset_cue = function( cue_name ) {
			if ( ! this.cues[ cue_name ] ) return;
			var me = this;

			( function( cue_name ) {
				me.clear_cue( cue_name );
				setInterval( function() { me.cues[ cue_name ].func(); }, me.cues[ cue_name ].every );
			} )( cue_name );
		};

		this.clear_cue = function( cue_name ) {
			if ( ! this.cues[ cue_name ] ) return;
			clearTimeout( this.cues[ cue_name ].timeout );
		};

		this.remove_cue = function( cue_name ) {
			if ( ! this.cues[ cue_name ] ) return;
			this.clear_cue( cue_name );
			delete this.cues[ cue_name ];
		};
	};

	if ( F.localStorage( window, document ) ) {
		QS.storage = new local_storage();
	} else {
		QS.storage = new non_local_storage();
	}
} )( jQuery, QS.Features.support, window, document );
