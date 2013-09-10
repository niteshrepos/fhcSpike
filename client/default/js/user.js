var syncUser = (function() {

  var self = {

    syncTable: undefined,
    recordDelayVal: undefined,

    init: function() {
      // Ensure UI is set up correctly
      $('#updateBtn').attr('disabled', 'disabled');

      $('#isOnlineChk').unbind().click(self.setOnline);
      $('#updateBtn').unbind().click(self.updateItem);
      $('#addBtn').unbind().click(self.addItem);
      $('#syncDelayBtn').unbind().click(self.setSyncDelay);
      $('#recordDelayBtn').unbind().click(self.setRecordDelay);
      $('#clearNotificationsBtn').unbind().click(self.clearNotifications);

      // Initialise the Sync Service. See http://docs.feedhenry.com/v2/api_js_client_api.html#$fh.sync for details on initialisation options
      sync.init({
        "sync_frequency": 5,
        "do_console_log" : true
      });

      // Provide handler function for receiving notifications from sync service - e.g. data changed
      sync.notify(self.handleSyncNotifications);

      // Get the Sync service to manage the dataset called "myShoppingList"
      sync.manage(datasetId, {});

    },

    handleSyncNotifications: function(notification) {
      var msg = moment().format('YYYY-MM-DD HH:mm:ss') + ' : ' + notification.code + ' (uid:' + notification.uid + ', msg:' + notification.message + ')\n';
      $('#notifications').val(msg + $('#notifications').val());

      if( 'sync_complete' == notification.code ) {
        datasetHash = notification.uid;
        sync.doList(datasetId, self.handleListSuccess, self.handleListFailure);
      }
      else if( 'local_update_applied' === notification.code ) {
        // Reflect local updates in table immediately
        sync.doList(datasetId, self.handleListSuccess, self.handleListFailure);
      }
      else if( 'remote_update_failed' === notification.code ) {
        var errorMsg = notification.message ? notification.message.msg ? notification.message.msg : undefined : undefined;
        var action = notification.message ? notification.message.action ? notification.message.action : 'action' : 'action';
        var errorStr = 'The following error was returned from the data store: ' + errorMsg;

        alert('Unable to perform ' + action +  ' on record ' + notification.uid + '. ' + errorStr);
      }
    },

    clearNotifications: function() {
      $('#notifications').val('');
    },

    handleListSuccess: function(res) {
      var tableData = [];
      // Iterate over the dataset to create a record structure which is suitable for the jQuery Data table
      // we are using to display the data (i.e a 2d array)

      var controls = [];
      controls.push('<button class="btn edit btn-small"><i class="icon-pencil"></i> Edit</button>&nbsp;');
      controls.push('<button class="btn delete btn-small"><i class="icon-trash"></i> Delete</button>&nbsp;');

      for( i in res ) {
        var row = [];
        var rec = res[i];
        row.push(i);
        row.push(rec.data.name);
        row.push(moment(rec.data.created).format('YYYY-MM-DD HH:mm:ss'));
        row.push(controls.join(""));
        tableData.push(row);
      }

      self.reloadTable(tableData);
    },

    handleListFailure: function(code, msg) {
      alert('An error occured while listing data : (' + code + ') ' + msg);
    },

    addItem: function() {
      console.log('addItem Called...');
      var name = $('#itemIn').val();
      var created = new Date().getTime();
      var dataItem = {
        "name" : name,
        "created" : created,
        "recordDelay" : self.recordDelayVal
      };
      sync.doCreate(datasetId, dataItem, function(res) {
        //console.log('Create item success');
      }, function(code, msg) {
        alert('An error occured while creating data : (' + code + ') ' + msg);
      });

      // Clear the add item text box
      $('#itemIn').val('');
    },

    updateItem: function() {
      // Read the data from the fields
      var name = $('#itemUp').val();
      var uid = $('#itemUpId').val();

      // Reset fields and disable update button
      $('#itemUp').val('');
      $('#itemUpId').val('');
      $('#updateBtn').attr('disabled', 'disabled');

      // Read the full record from the sync service
      sync.doRead(datasetId, uid, function(res) {
        var data = res.data;
        // Update the name field with the updated value from the text box
        data.name = name;
        data.recordDelay = self.recordDelayVal;

        // Send the update to the sync service
        sync.doUpdate(datasetId, uid, data, function(res) {
          //console.log('Update item success');
        },
        function(code, msg) {
          alert('Unable to update row : (' + code + ') ' + msg);
        });
      }, function(code, msg) {
        alert('Unable to read row for updating : (' + code + ') ' + msg);
      });
    },

    setSyncDelay: function() {
      var query_params = {
        syncDelay : $('#syncDelay').val()
      };

      sync.manage(datasetId, {}, query_params);
    },

    setRecordDelay: function() {
      self.recordDelayVal = $('#recordDelay').val();
    },

    reloadTable: function(contents) {
      if( contents.length == 0 ) {
        $('#nosyncdata').show();
        $('#table').hide();
        return;
      }

      // show the table & hide the no data message
      $('#nosyncdata').hide();
      $('#table').show();

      self.syncTable = $('#shoppingList').dataTable( {
        "bDestroy":true,
        "bLengthChange": false,
        "bFilter": false,
        "aaData": contents,
        "aoColumns": [
          { "sTitle": "UID", "sWidth": "150" },
          { "sTitle": "Item Text" },
          { "sTitle": "Date Created", "sWidth": "300" },
          { "sTitle": "Controls", "bSortable": false, "sClass": "controls", "sWidth": "150" }
        ]
      });

      $('tr td .edit, tr td .delete, tr td:not(.controls,.dataTables_empty)').unbind().click(function() {
        var row = $(this).parent().parent();
        var data = self.syncTable.fnGetData($(this).closest('tr').get(0));

        if($(this).hasClass('edit')) {
          self.doEditRow(data);
        }
        else if( $(this).hasClass('delete')) {
          self.doDeleteRow(data);
        }
        return false;
      });
    },

    doEditRow: function(row) {
      sync.doRead(datasetId, row[0], function(res) {
        console.log('read ', res);
        $('#itemUp').val(res.data.name);
        $('#itemUpId').val(row[0]);
        $('#updateBtn').removeAttr('disabled');
      },
      function(code, msg) {
        alert('Unable to read row for editing : (' + code + ') ' + msg);
      });
    },

    doDeleteRow: function(row) {
      sync.doRead(datasetId, row[0], function(res) {
        var doDelete = confirm('Are you sure you wish to delete this row')
        if( doDelete ) {
          sync.doDelete(datasetId, row[0], function(res) {
            //console.log('Delete item success');
          },
          function(code, msg) {
            alert('Unable to delete row : (' + code + ') ' + msg);
          });
        }
      },
      function(code, msg) {
        alert('Unable to read row for deleting : (' + code + ') ' + msg);
      });
    },

    setOnline: function() {
      var isOnline = $('#isOnlineChk').is(":checked")
      console.log('isOnline = ' + isOnline);
      //navigator.network.connection.type
      navigator.network = navigator.network || {};
      navigator.network.connection = navigator.network.connection || {}
      navigator.network.connection.type = isOnline ? 'WiFi' : 'none';
    }
  };

  return {
    init: self.init
  }
})();
