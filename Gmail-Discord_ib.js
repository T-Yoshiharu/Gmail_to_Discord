function mail_ib() {
  // idをid.jsonファイルから取得する
  const id_json = PropertiesService.getScriptProperties().getProperty("id_json"); //スクリプトプロパティからid.jsonのファイルIDを取得
  const id_file = DriveApp.getFileById(id_json);
  const jsonStr = id_file.getBlob().getDataAsString("UTF-8");
  const IDs = JSON.parse(jsonStr);

  // all-intebroのスレッドをGmailから取得
  let now = new Date()
  now.setDate(now.getDate() - 1)
  let today = Utilities.formatDate(now, "JST", "yyyy/MM/dd");
  const data = GmailApp.search(`label:intebro全体 after:${today}`);
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
      const date = Utilities.formatDate(message.getDate(), "JST", "yyyy/MM/dd kk:mm");

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

        // 機材借用申請の場合に追加の処理をする
        if (subject.includes('機材借用申請')) {
          const folderId = IDs.applicationFolder_id;
          const application_Webhook = IDs.application_Webhook;
          application(message, folderId, application_Webhook);
        }
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

function application(message_data, folderId, webhookURL) {
  // const filter = 'label:intebro全体-機材借用申請 ';
  const subject = message_data.getSubject();
  const titleMatch = subject.match(/_([^_]*)_/);
  const title = titleMatch ? titleMatch[1] : "";
  const applicationDateMatch = subject.match(/([^_]*)_/);
  const applicationDate = applicationDateMatch ? applicationDateMatch[1] : "";
  const from = message_data.getFrom();
  const fromName = from.match(/"([^"]*)"/)[1];
  const date_time = Utilities.formatDate(message_data.getDate(), "JST", "yyyy/MM/dd kk:mm");
  const date = Utilities.formatDate(message_data.getDate(), "JST", "yyyy/MM/dd");

  const attachments = message_data.getAttachments();
  let folder = DriveApp.getFolderById(folderId);
  let f_Names = [];
  let fileUrls = [];
  for (let k = 0; k < attachments.length; k++) {
    let attachment = attachments[k];
    let fileName = attachment.getName();

    // 添付ファイル名にキーワードが含まれているか確認
    if (fileName.indexOf('機材借用') !== -1) {
      // ファイルを保存
      let file = folder.createFile(attachment);
      f_Names.push(fileName);
      // ファイルのリンクを取得
      fileUrls.push(file.getUrl());
    }
  }

  const payload = {
    content: `### 機材借用申請通知 (${date_time})`,
    embeds: [{
      title: `[${title}]の機材借用申請`,
      color: 0x0000ff,
      author: {
        name: `From; ${from}`,
      },
      description: `${subject}`,
      fields: [
        {
          name: "件名",
          value: `${title}`,
          inline: false,
        },
        {
          name: "借用年月日",
          value: `${applicationDate}`,
          inline: false,
        },
        {
          name: "申請者",
          value: `${fromName}`,
          inline: false,
        },
        {
          name: "申請年月日",
          value: `${date}`,
          inline: false,
        },
        {
          name: "機材借用申請書ファイル",
          value: ``,
          inline: false,
        }],
    }],

  }

  if (f_Names.length > 0) {
    let value = "";
    for (let i = 0; i < f_Names.length; i++) {
      value += `- [${f_Names[i]}](${fileUrls[i]})\n`
    }
    payload.embeds[0].fields[4] = {
      name: "機材借用申請書ファイル",
      value: `${value}`,
      inline: false,
    }
  } else {
    payload.embeds[0].fields[4] = {
      name: "機材借用申請書ファイル",
      value: `機材借用申請書ファイルがありません!`,
      inline: false,
    }
  }

  var response = UrlFetchApp.fetch(
    webhookURL,
    {
      method: "POST",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    }
  );
}