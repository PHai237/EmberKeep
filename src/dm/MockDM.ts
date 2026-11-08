import type { DMProvider, DMResponse } from './DMProvider.ts';
import type { CampaignState, GameEvent } from '../domain/types.ts';

export class MockDM implements DMProvider {
  readonly name = 'MockDM — kịch bản offline';

  async narrate(event: GameEvent, state: CampaignState): Promise<DMResponse> {
    const data = event.data;
    let narration = 'Hầm rượu vẫn im, chờ lựa chọn tiếp theo của hai bạn.';
    const npcSpeech: DMResponse['npcSpeech'] = [];
    switch (data.type) {
      case 'action_submitted':
        narration = `${state.characters[data.characterId].name} thử: “${data.text}”. Đây là hành động tự do; dùng các nút cơ chế khi cần thay đổi trạng thái.`;
        break;
      case 'npc_spoken':
        narration = 'Sera hạ giọng, chỉ về phía chiếc rương và dãy thùng gỗ rung nhẹ.';
        npcSpeech.push({ npcId: 'npc-sera', text: 'Tìm chìa khóa trong rương. Nhưng cẩn thận—thứ sau đống thùng đã gặm mất hai bao lúa.' });
        break;
      case 'dice_rolled':
        narration = `${state.characters[data.characterId].name} tung d${data.result.die}: ${data.result.rolls[0]} ${data.result.modifier >= 0 ? '+' : '−'} ${Math.abs(data.result.modifier)} = ${data.result.total}.`;
        break;
      case 'check_resolved':
        narration = data.result.success
          ? `Mép khóa có vết cạy mới. Kết quả ${data.result.total} đạt DC ${data.result.dc}; nắp rương bật mở, để lộ chìa khóa đồng.`
          : `Bụi và gỉ sắt che mất cơ cấu. Kết quả ${data.result.total} chưa đạt DC ${data.result.dc}; bạn có thể đổi người điều tra.`;
        break;
      case 'item_transferred':
        narration = `${state.characters[data.toCharacterId].name} cất chìa khóa đồng. Vật phẩm giờ thuộc đúng một túi đồ.`;
        break;
      case 'combat_started':
        narration = 'Đống thùng đổ nghiêng. Một con chuột tro khổng lồ lao ra; thứ tự lượt đã được khóa bởi engine.';
        break;
      case 'attack_resolved':
        narration = data.hit
          ? `Đòn đánh trúng, gây ${data.appliedDamage} sát thương đã được engine giới hạn theo HP.`
          : `Đòn đánh trượt (tổng ${data.attack.total}); không có HP nào thay đổi.`;
        break;
      case 'quest_completed':
        narration = 'Chìa khóa xoay trong ổ cửa sân. Không khí ban đêm ùa vào; Sera đã có một lối thoát an toàn. Nhiệm vụ hoàn thành.';
        break;
      case 'item_purchased':
        narration = `Sera gật đầu, đẩy ${data.item.name} về phía ${state.characters[data.buyerId].name}. Túi tiền nhẹ đi ${data.price} đồng vàng.`;
        break;
      case 'item_sold':
        narration = `Sera kiểm tra món đồ rồi đưa lại ${data.price} đồng vàng. Giao dịch đã được ghi nhận.`;
        break;
      case 'item_consumed':
        narration = `${state.characters[data.characterId].name} uống bình hồi phục, lấy lại ${data.healed} sinh lực. Chiếc lọ rỗng được bỏ đi.`;
        break;
      case 'location_changed':
        narration = state.quest.completed
          ? 'Chìa khóa xoay trong ổ. Cánh cửa mở ra sân đá dưới trời đêm. Sera sẽ nhớ rằng hai người đã mở được lối thoát. Nhiệm vụ hoàn thành.'
          : 'Hai người bước sang địa điểm mới.';
        break;
      case 'character_updated':
        narration = `Character sheet của ${state.characters[data.characterId].name} đã được lưu thành sự kiện.`;
        break;
      default:
        break;
    }
    return { narration, npcSpeech, basedOnEventId: event.id };
  }
}
