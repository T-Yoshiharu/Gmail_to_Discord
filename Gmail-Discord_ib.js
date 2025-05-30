function mail_ib() {
  // idをid.jsonファイルから取得する
  const id_json = PropertiesService.getScriptProperties().getProperty("id_json"); //スクリプトプロパティからid.jsonのファイルIDを取得
  const id_file = DriveApp.getFileById(id_json);
  const jsonStr = id_file.getBlob().getDataAsString("UTF-8");
  const IDs = JSON.parse(jsonStr);

  const data = GmailApp.search('label:intebro全体 label:unread');  // all-intebroのスレッドを取得
  const threads = data.reverse();

  if (threads.length == 0) {
    // Logger.log('新規メッセージなし');
    return
  }

  threads.forEach(function (thread) {
    const messages = thread.getMessages();

    let payloads = messages.map(function (message) {
      //  message.markRead();  // メールを既読に設定する
      const id = message.getId();
      const from = message.getFrom();
      const subject = message.getSubject();
      const plainBody = message.getPlainBody();
      const date = Utilities.formatDate(message.getDate(), "JST", "yyyy/MM/dd hh:mm");

      const sheet = SpreadsheetApp.openById(IDs.data_sheet).getSheetByName("mails"); // スプレッドシートを取得
      const lastRow = sheet.getLastRow(); // 既にスプレッドシートにある件名と日付を取得
      let values = [];
      const ids = sheet.getRange(2, 1, lastRow).getValues().flat();
      let unsend = false;

      if (!ids.includes(id)) {
        const record = [
          id,
          date,
          subject
        ];
        values.push(record);
        unsend = true;
      }

      if (values.length > 0) {
        sheet.getRange(lastRow + 1, 1, values.length, values[0].length).setValues(values);
      }

      const webhook = IDs.discord_hook;

      if (unsend) {
        Logger.log(subject);
        const payload = {
          content: `### [${subject}] (${date})`,
          embeds: [{
            title: subject,
            author: {
              name: `From; ${from}`,
            },
            description: plainBody,
          }],
        }
        return {
          url: webhook,
          contentType: 'application/json',
          payload: JSON.stringify(payload),
        }
      }
    })
    payloads = payloads.filter(Boolean);
    if (payloads.length > 0) {
      UrlFetchApp.fetchAll(payloads);
    }
  })
}
