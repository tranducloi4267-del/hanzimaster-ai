import type { ExamSection } from '@/types';

export interface OfflineMockExam {
  id: string;
  title: string;
  level: number;
  durationMinutes: number;
  descriptionVi: string;
  sections: ExamSection[];
}

/**
 * 2 bộ đề thi thử chuẩn HSK 1 và HSK 2–3 chạy 100% Offline ngay khi mở app.
 */
export const OFFLINE_MOCK_EXAMS: OfflineMockExam[] = [
  {
    id: 'mock_hsk1_01',
    title: 'Đề thi thử chuẩn HSK 1 — Bộ số 01 (Offline)',
    level: 1,
    durationMinutes: 15,
    descriptionVi:
      'Gồm 3 phần đầy đủ: Nghe hiểu (phát TTS), Đọc hiểu ngữ cảnh và Viết sắp xếp câu cơ bản.',
    sections: [
      {
        type: 'listening',
        title: 'Phần 1 · Nghe hiểu (听力)',
        instructionsVi: 'Bấm nút Nghe đoạn hội thoại ngắn bằng tiếng Trung rồi chọn đáp án đúng nhất.',
        questions: [
          {
            id: 'h1_l1',
            section: 'listening',
            audioText: '男：请问，现在几点了？女：现在八点半了，快去上课吧！问：现在几点？',
            promptHanzi: '听录音，请问现在几点了？',
            promptPinyin: 'Tīng lùyīn, qǐngwèn xiànzài jǐ diǎn le?',
            promptVi: 'Nghe đoạn hội thoại: Bây giờ là mấy giờ?',
            options: [
              { key: 'A', hanzi: '七点半', pinyin: 'qī diǎn bàn' },
              { key: 'B', hanzi: '八点半', pinyin: 'bā diǎn bàn' },
              { key: 'C', hanzi: '九点半', pinyin: 'jiǔ diǎn bàn' },
              { key: 'D', hanzi: '十点半', pinyin: 'shí diǎn bàn' }
            ],
            correctAnswer: 'B',
            explanationVi:
              'Người nữ nói: "现在八点半了，快去上课吧！" (Bây giờ là 8 giờ rưỡi rồi, mau đi học thôi!). Đáp án đúng là B.'
          },
          {
            id: 'h1_l2',
            section: 'listening',
            audioText: '女：你去哪儿？男：我去书店买两本汉语书。问：男的想去买什么？',
            promptHanzi: '听录音，男的想去买什么？',
            promptPinyin: 'Tīng lùyīn, nán de xiǎng qù mǎi shénme?',
            promptVi: 'Người nam muốn đi mua gì?',
            options: [
              { key: 'A', hanzi: '水果', pinyin: 'shuǐguǒ' },
              { key: 'B', hanzi: '衣服', pinyin: 'yīfu' },
              { key: 'C', hanzi: '汉语书', pinyin: 'Hànyǔ shū' },
              { key: 'D', hanzi: '杯子', pinyin: 'bēizi' }
            ],
            correctAnswer: 'C',
            explanationVi:
              'Người nam nói: "我去书店买两本汉语书" (Tôi ra hiệu sách mua hai quyển sách tiếng Trung). Đáp án đúng là C.'
          },
          {
            id: 'h1_l3',
            section: 'listening',
            audioText: '女：明天天气怎么样？男：天气预报说明天会下雨，你别忘了带伞。问：明天天气怎么样？',
            promptHanzi: '听录音，明天天气怎么样？',
            promptPinyin: 'Tīng lùyīn, míngtiān tiānqì zěnmeyàng?',
            promptVi: 'Thời tiết ngày mai thế nào?',
            options: [
              { key: 'A', hanzi: '下雨', pinyin: 'xiàyǔ' },
              { key: 'B', hanzi: '很热', pinyin: 'hěn rè' },
              { key: 'C', hanzi: '下雪', pinyin: 'xiàxuě' },
              { key: 'D', hanzi: '晴天', pinyin: 'qíngtiān' }
            ],
            correctAnswer: 'A',
            explanationVi: 'Người nam nói "明天会下雨" (Ngày mai sẽ mưa). Đáp án là A.'
          }
        ]
      },
      {
        type: 'reading',
        title: 'Phần 2 · Đọc hiểu (阅读)',
        instructionsVi: 'Đọc câu tiếng Trung và chọn từ/đáp án phù hợp nhất với ngữ pháp và ngữ cảnh.',
        questions: [
          {
            id: 'h1_r1',
            section: 'reading',
            promptHanzi: '桌子上放着三____中文书。',
            promptPinyin: 'Zhuōzi shàng fàngzhe sān ____ Zhōngwén shū.',
            promptVi: 'Chọn lượng từ thích hợp điền vào chỗ trống:',
            options: [
              { key: 'A', hanzi: '个', pinyin: 'gè' },
              { key: 'B', hanzi: '本', pinyin: 'běn' },
              { key: 'C', hanzi: '杯', pinyin: 'bēi' },
              { key: 'D', hanzi: '块', pinyin: 'kuài' }
            ],
            correctAnswer: 'B',
            explanationVi: 'Lượng từ chuẩn cho sách vở (书) là 本 (běn) → 三本中文书 (ba quyển sách tiếng Trung).'
          },
          {
            id: 'h1_r2',
            section: 'reading',
            promptHanzi: '明天上午我____医院看医生。',
            promptPinyin: 'Míngtiān shàngwǔ wǒ ____ yīyuàn kàn yīshēng.',
            promptVi: 'Chọn động từ đúng:',
            options: [
              { key: 'A', hanzi: '去', pinyin: 'qù' },
              { key: 'B', hanzi: '吃', pinyin: 'chī' },
              { key: 'C', hanzi: '喝', pinyin: 'hē' },
              { key: 'D', hanzi: '买', pinyin: 'mǎi' }
            ],
            correctAnswer: 'A',
            explanationVi: '去 + Địa điểm + Động từ: 去医院看医生 (đi bệnh viện khám bác sĩ).'
          },
          {
            id: 'h1_r3',
            section: 'reading',
            promptHanzi: '“请问，火车站在哪儿？” — 下面哪个回答最合适？',
            promptPinyin: '"Qǐngwèn, huǒchēzhàn zài nǎr?"',
            promptVi: 'Câu trả lời nào phù hợp nhất cho câu hỏi đường trên?',
            options: [
              { key: 'A', hanzi: '我二十岁了。', pinyin: 'Wǒ èrshí suì le.' },
              { key: 'B', hanzi: '在学校前面。', pinyin: 'Zài xuéxiào qiánmiàn.' },
              { key: 'C', hanzi: '我喜欢喝茶。', pinyin: 'Wǒ xǐhuan hē chá.' },
              { key: 'D', hanzi: '三十块钱。', pinyin: 'Sānshí kuài qián.' }
            ],
            correctAnswer: 'B',
            explanationVi: 'Hỏi vị trí 在哪儿 (ở đâu) → Trả lời bằng phương vị 在学校前面 (ở phía trước trường học).'
          }
        ]
      },
      {
        type: 'writing',
        title: 'Phần 3 · Viết câu (书写)',
        instructionsVi: 'Sắp xếp các từ cho sẵn thành câu tiếng Trung hoàn chỉnh hoặc tự viết câu theo yêu cầu.',
        questions: [
          {
            id: 'h1_w1',
            section: 'writing',
            promptHanzi: '请连词成句：很 / 我 / 汉语 / 喜欢 / 学习',
            promptVi: 'Sắp xếp thành câu hoàn chỉnh: 很 / 我 / 汉语 / 喜欢 / 学习',
            correctAnswer: '我很喜欢学习汉语。',
            explanationVi: 'Trật tự chuẩn: Chủ ngữ (我) + Phó từ (很) + Động từ tâm lý (喜欢) + Cụm động tân (学习汉语).'
          },
          {
            id: 'h1_w2',
            section: 'writing',
            promptHanzi: '请用“和”和“一起”写一个句子。',
            promptVi: 'Hãy đặt 1 câu tiếng Trung có sử dụng cả "和" (và) và "一起" (cùng nhau).',
            correctAnswer: '我和朋友一起去公园。',
            explanationVi: 'Mẫu câu chuẩn: A + 和 + B + 一起 + Động từ (Ví dụ: 我和朋友一起去吃饭。).'
          }
        ]
      }
    ]
  },
  {
    id: 'mock_hsk3_01',
    title: 'Đề thi thử chuẩn HSK 2–3 — Bộ số 02 (Offline)',
    level: 3,
    durationMinutes: 20,
    descriptionVi:
      'Kiểm tra điểm ngữ pháp trọng tâm HSK 2–3: câu chữ 把, so sánh 比, 就 vs 才, 的/地/得 và đọc hiểu hội thoại.',
    sections: [
      {
        type: 'listening',
        title: 'Phần 1 · Nghe hiểu HSK 2–3 (听力)',
        instructionsVi: 'Nghe đoạn hội thoại và chọn đáp án phản ánh đúng nội dung.',
        questions: [
          {
            id: 'h3_l1',
            section: 'listening',
            audioText: '女：你今天怎么十点才来公司？男：不好意思，今天早上路太堵了，我坐地铁也迟到了二十分钟。问：男的为什么迟到？',
            promptHanzi: '听录音，男的为什么迟到了？',
            promptPinyin: 'Tīng lùyīn, nán de wèishénme chídào le?',
            promptVi: 'Vì sao người nam đi làm muộn?',
            options: [
              { key: 'A', hanzi: '起床太晚了', pinyin: 'qǐchuáng tài wǎn le' },
              { key: 'B', hanzi: '早上路很堵', pinyin: 'zǎoshang lù hěn dǔ' },
              { key: 'C', hanzi: '忘带手机了', pinyin: 'wàng dài shǒujī le' },
              { key: 'D', hanzi: '生病去医院了', pinyin: 'shēngbìng qù yīyuàn le' }
            ],
            correctAnswer: 'B',
            explanationVi: 'Người nam giải thích "今天早上路太堵了" (Sáng nay đường tắc quá). Đáp án đúng là B.'
          },
          {
            id: 'h3_l2',
            section: 'listening',
            audioText: '男：这件白衬衫真漂亮，多少钱？女：原价三百块，今天店庆打八折，只要二百四十块。问：这件衬衫今天卖多少钱？',
            promptHanzi: '听录音，这件衬衫今天卖多少钱？',
            promptPinyin: 'Zhè jiàn chènshān jīntiān mài duōshao qián?',
            promptVi: 'Hôm nay chiếc áo sơ mi này bán giá bao nhiêu?',
            options: [
              { key: 'A', hanzi: '三百块', pinyin: 'sānbǎi kuài' },
              { key: 'B', hanzi: '二百四十块', pinyin: 'èrbǎi sìshí kuài' },
              { key: 'C', hanzi: '一百八十块', pinyin: 'yībǎi bāshí kuài' },
              { key: 'D', hanzi: '二百块', pinyin: 'èrbǎi kuài' }
            ],
            correctAnswer: 'B',
            explanationVi:
              'Chú ý cách tính giảm giá tiếng Trung: 打八折 là trả 80% giá gốc (giảm 20%) → 300 × 80% = 240 tệ (二百四十块).'
          }
        ]
      },
      {
        type: 'reading',
        title: 'Phần 2 · Ngữ pháp & Đọc hiểu (阅读)',
        instructionsVi: 'Chọn đáp án chính xác nhất về ngữ pháp HSK 2–3.',
        questions: [
          {
            id: 'h3_r1',
            section: 'reading',
            promptHanzi: '他汉语说____非常流利，大家都很佩服他。',
            promptPinyin: 'Tā Hànyǔ shuō ____ fēicháng liúlì.',
            promptVi: 'Chọn trợ từ thích hợp (的 / 地 / 得):',
            options: [
              { key: 'A', hanzi: '的', pinyin: 'de' },
              { key: 'B', hanzi: '地', pinyin: 'de' },
              { key: 'C', hanzi: '得', pinyin: 'de' },
              { key: 'D', hanzi: '着', pinyin: 'zhe' }
            ],
            correctAnswer: 'C',
            explanationVi: 'Cấu trúc bổ ngữ trình độ: Động từ (说) + 得 + Phó từ/Tính từ đánh giá (非常流利).'
          },
          {
            id: 'h3_r2',
            section: 'reading',
            promptHanzi: '电影八点开始，他七点半____到了，真是准时！',
            promptPinyin: 'Diànyǐng bā diǎn kāishǐ, tā qī diǎn bàn ____ dào le.',
            promptVi: 'Chọn phó từ 就 hay 才:',
            options: [
              { key: 'A', hanzi: '才', pinyin: 'cái' },
              { key: 'B', hanzi: '就', pinyin: 'jiù' },
              { key: 'C', hanzi: '再', pinyin: 'zài' },
              { key: 'D', hanzi: '刚', pinyin: 'gāng' }
            ],
            correctAnswer: 'B',
            explanationVi:
              'Phim 8h chiếu nhưng 7h30 anh ấy ĐÃ tới (sớm hơn dự kiến, và cuối câu có 了) → bắt buộc dùng 就!'
          },
          {
            id: 'h3_r3',
            section: 'reading',
            promptHanzi: '今天____昨天凉快多了，我们去公园跑步吧。',
            promptPinyin: 'Jīntiān ____ zuótiān liángkuai duō le.',
            promptVi: 'Chọn giới từ so sánh đúng:',
            options: [
              { key: 'A', hanzi: '把', pinyin: 'bǎ' },
              { key: 'B', hanzi: '被', pinyin: 'bèi' },
              { key: 'C', hanzi: '比', pinyin: 'bǐ' },
              { key: 'D', hanzi: '离', pinyin: 'lí' }
            ],
            correctAnswer: 'C',
            explanationVi: 'Cấu trúc so sánh hơn: A + 比 + B + Tính từ + 多了 (Hôm nay mát hơn hôm qua nhiều).'
          },
          {
            id: 'h3_r4',
            section: 'reading',
            promptHanzi: '出门前请____窗户关好，以免一会儿下雨。',
            promptPinyin: 'Chūmén qián qǐng ____ chuānghu guānhǎo.',
            promptVi: 'Chọn giới từ phù hợp cho câu xử lý đối tượng:',
            options: [
              { key: 'A', hanzi: '把', pinyin: 'bǎ' },
              { key: 'B', hanzi: '从', pinyin: 'cóng' },
              { key: 'C', hanzi: '向', pinyin: 'xiàng' },
              { key: 'D', hanzi: '跟', pinyin: 'gēn' }
            ],
            correctAnswer: 'A',
            explanationVi:
              'Câu chữ 把 diễn đạt hành động tác động làm thay đổi trạng thái vật: 把 + 窗户 + 关好 (đóng kỹ cửa sổ).'
          }
        ]
      },
      {
        type: 'writing',
        title: 'Phần 3 · Viết câu HSK 3 (书写)',
        instructionsVi: 'Sắp xếp thành câu hoàn chỉnh hoặc viết đoạn ngắn theo yêu cầu.',
        questions: [
          {
            id: 'h3_w1',
            section: 'writing',
            promptHanzi: '请连词成句：已经 / 作业 / 把 / 写完了 / 我 / 今天的',
            promptVi: 'Sắp xếp thành câu chữ 把 hoàn chỉnh:',
            correctAnswer: '我已经把今天的作业写完了。',
            explanationVi: 'Trật tự chuẩn câu chữ 把: Chủ ngữ (我) + Phó từ (已经) + 把 + Tân ngữ (今天的作业) + Động từ + Kết quả (写完了).'
          },
          {
            id: 'h3_w2',
            section: 'writing',
            promptHanzi: '请用“虽然……但是……”写一句话介绍你学习汉语的体会。',
            promptVi: 'Dùng cấu trúc "虽然...但是..." viết 1 câu chia sẻ cảm nhận học tiếng Trung của bạn.',
            correctAnswer: '虽然汉语声调有点难，但是我觉得非常有意思。',
            explanationVi: 'Cặp liên từ tương phản: 虽然 + vế nhượng bộ，但是 + vế chính.'
          }
        ]
      }
    ]
  }
];
