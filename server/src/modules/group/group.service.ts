import {
  BadRequestException,
  forwardRef,
  HttpCode,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from "@nestjs/common";
import { HttpErrorByCode } from "@nestjs/common/utils/http-error-by-code.util";
import HttpError from "src/commons/httpError";

import { Group } from "src/entities/group.entity";
import { AuthRepository } from "src/repositories/auth.repository";
import { GroupRepository } from "src/repositories/group.repository";
import { ScheduleRepository } from "src/repositories/schedule.repository";
import { UserRepository } from "src/repositories/user.repository";
import { CreateConditionDto } from "./dto/createCondition.dto";
import { UpdateConditionDto } from "./dto/updateCondition.dto";

@Injectable()
export class GroupService {
  constructor(
    @Inject(forwardRef(() => ScheduleRepository))
    private readonly scheduleRepository: ScheduleRepository,
    private readonly groupRepository: GroupRepository,
    private readonly authRepository: AuthRepository,
    private readonly userRepository: UserRepository,
  ) {}

  // 신규 그룹 추가
  async createGroup(auth: string, group: Group) {
    // 요청된 그룹데이터를 받아서 그룹도큐먼트에 저장
    try {
      const { _id }: any = await this.authRepository.validateToken(auth);
      // 토큰의 오브젝트아이디정보가 제대로 들어있는가?
      if (!_id) throw new UnauthorizedException("Unauthorized");
      const createdGroup: any = await this.groupRepository.createGroup(group);
      if (createdGroup) {
        // 성공시 user에 그룹 아이디 추가
        const result: any = await this.userRepository.addGroupIdFromGroup(
          _id,
          createdGroup,
        );
        return result;
      }
    } catch (err) {
      throw new InternalServerErrorException("Not Created");
    }
  }

  // 그룹 정보 조회
  async getGroup(auth: string) {
    const { _id }: any = await this.authRepository.validateToken(auth);
    // 토큰의 오브젝트아이디정보가 제대로 들어있는가?
    if (!_id) throw new UnauthorizedException("Unauthorized");

    const { groups }: any = await this.userRepository.getGroup(_id);
    if (!groups.length) return null;
    return groups;
  }

  // 그룹 정보 수정
  async updateGroup(auth: string, groupId: string, group: Group) {
    if (!auth.length || !groupId.length || !Object.keys(group).length) {
      throw new BadRequestException("Bad Requst");
    } else {
      // 요청이 제대로 왔다면
      const { _id }: any = await this.authRepository.validateToken(auth);

      // 해당 그룹의 소유자인 유저인가?
      const flag: boolean = await this.userRepository.getUserGroupId(
        _id,
        groupId,
      );
      console.log(flag);
      // 유저가 해당 그룹의 아이디를 가지고 있지 않다면.
      if (!flag) throw new UnauthorizedException("Unauthorized");
      // 있다면 그룹 데이터 업데이트
      else await this.groupRepository.updateGroup(groupId, group);
    }
  }

  // 그룹 삭제
  async removeGroup(auth: string, groupId: string) {
    // 요청 정보 확인
    if (!auth.length || !groupId.length) {
      throw new BadRequestException("Bad Requst");
    } else {
      // 토큰 정보 복호화
      const { _id }: any = await this.authRepository.validateToken(auth);
      // 해당 유저가 갖고 있는 유저의 해당 그룹 아이디 정보 삭제
      await this.userRepository.removeGroupFromUser(_id, groupId);
      // 해당 그룹이 갖고 있는 스케쥴을 삭제하기 위해 그룹 도큐먼트에서 스켸쥴 아이디만 조회
      const { schedules }: any =
        await this.groupRepository.getScheduleIdFromGroup(groupId);
      // 해당 스케쥴 삭제
      schedules.forEach(async (scheduleId) => {
        await this.scheduleRepository.removeSchedule(scheduleId);
      });
      // 해당 그룹 삭제
      await this.groupRepository.removeGroup(groupId);
    }
  }

  // ! 멤버 정보 초기화
  // * DELETE "/memeber/:groupId" 연결
  async resetMember(groupId: string) {
    return this.groupRepository.resetMembersByGroupId(groupId);
  }

  // ? 새로운 멤버 추가
  // * POST "/member/:groupId" 연결
  async createMember(authorization: string, member: Group, groupId: string) {
    // * 토큰 유효성 검사
    try {
      this.authRepository.validateToken(authorization);
    } catch (err) {
      throw new HttpError(401, err.message);
    }

    // * 멤버간 Id 값 중복을 피하기 위해 memberIdCount +1 증가 및 기존 IdCount 값 추출
    const IdCount: Group =
      await this.groupRepository.increaseMemberIdCountByGroupId(groupId);

    if (!IdCount) throw new HttpError(400, "groupId 값이 올바르지 않습니다");

    // * memberIdCount 최신 값으로 memberId 값 설정
    const newMember: Group = Object.assign(
      {},
      { memberId: IdCount.memberIdCount },
      member,
    );
    // * 그룹 아이디로 그룹 조회하여 멤버 추가
    const result = await this.groupRepository.addMemberToGroupByGroupId(
      groupId,
      newMember,
    );
    if (!result) {
      throw new HttpError(500, "업데이트가 정상적으로 완료되지 않았습니다.");
    } else {
      return "업데이트가 정상적으로 완료되었습니다.";
    }
  }

  // ? 기존 멤버 편집
  // * PATCH "/member/:groupId/:memberId" 연결
  async updateMember(
    authorization: string,
    params: { groupId: string; memberId: number },
    memberData: any,
  ) {
    // * 토큰 유효성 검사
    try {
      this.authRepository.validateToken(authorization);
    } catch (err) {
      throw new HttpError(401, err.message);
    }

    // * 전달되는 memberId 숫자 값으로 변형 후 업데이트 데이터에 저장
    params.memberId = Number(params.memberId);
    memberData.memberId = params.memberId;

    // * DB상 업데이트 진행
    const result = await this.groupRepository.updateMemberByGroupAndMemberIds(
      params.groupId,
      params.memberId,
      memberData,
    );

    if (!result) {
      throw new HttpError(500, "업데이트가 완료되지 않았습니다.");
    } else {
      return "업데이트가 정상적으로 완료되었습니다.";
    }
  }

  // ? 기존 멤버 삭제
  // * DELETE "/member/:groupId/:memberId" 연결
  async removeMember(
    authorization: string,
    params: { groupId: string; memberId: number },
  ) {
    // * 토큰 유효성 검사
    try {
      this.authRepository.validateToken(authorization);
    } catch (err) {
      throw new HttpError(401, err.message);
    }

    // * memberId 숫자형으로 변환 후 재할당
    params.memberId = Number(params.memberId);

    const result = await this.groupRepository.removeMemberByGroupAndMemberIds(
      params.groupId,
      params.memberId,
    );

    if (!result) {
      throw new HttpError(500, "삭제가 완료되지 않았습니다.");
    } else {
      return "삭제가 정상적으로 완료되었습니다.";
    }
  }

  /**
   * ? 새로운 조건 추가
   * * POST /condition/:groupId
   * @param authorization
   * @param groupId
   * @param condition
   * @returns
   */
  async createCondition(
    authorization: string,
    groupId: string,
    condition: CreateConditionDto,
  ) {
    // * 토큰 유효성 검사
    try {
      this.authRepository.validateToken(authorization);
    } catch (err) {
      throw new HttpError(401, err.message);
    }

    // * 조건간 Id 값 중복을 피하기 위해 conditionIdCount +1 증가 및 기존 conditionIdCount 값 추출
    const IdCount =
      await this.groupRepository.increaseConditionIdCountByGroupId(groupId);

    if (!IdCount) throw new HttpError(401, "groupId 값이 올바르지 않습니다.");

    // * 추가될 신규 조건에 conditionId 값 추가
    const newCondition: CreateConditionDto = Object.assign({}, condition, {
      conditionId: IdCount.conditionIdCount,
    });

    // * condition 추가 진행
    const result = await this.groupRepository.createConditionByGroupId(
      groupId,
      newCondition,
    );

    if (!result) {
      throw new HttpError(500, "조건 추가가 정상적으로 이루어지지 않았습니다");
    } else {
      return "조건 추가가 완료되었습니다";
    }
  }

  /**
   * ? 기존 조건 수정
   * * PATCH /condition/:groupId/:conditionId
   * @param authorization
   * @param params
   * @param conditionData
   * @returns
   */
  async updateCondition(
    authorization: string,
    params: { groupId: string; conditionId: number },
    conditionData: UpdateConditionDto,
  ) {
    // * 토큰 유효성 검사
    try {
      this.authRepository.validateToken(authorization);
    } catch (err) {
      throw new HttpError(401, err.message);
    }

    // * 전달된 conditionId 타입 Number Type으로 수정
    params.conditionId = Number(params.conditionId);
    conditionData.conditionId = params.conditionId;

    // * condition 업데이트 내용 DB 반영
    const result =
      await this.groupRepository.updateConditionByGroupAndConditionIds(
        params.groupId,
        params.conditionId,
        conditionData,
      );

    if (!result) {
      throw new HttpError(500, "조건 추가가 정상적으로 이루어지지 않았습니다");
    } else {
      return "조건 추가가 완료되었습니다";
    }
  }

  /**
   * ? 기존 조건 삭제
   * * DELETE /condition/:groupId/:conditionId
   * @param authorization
   * @param params
   * @returns
   */
  async removeCondition(
    authorization: string,
    params: { groupId: string; conditionId: number },
  ) {
    // * 토큰 유효성 검사
    try {
      this.authRepository.validateToken(authorization);
    } catch (err) {
      throw new HttpError(401, err.message);
    }

    // * 전달된 conditionId 타입 Number Type으로 수정
    params.conditionId = Number(params.conditionId);

    const result =
      await this.groupRepository.removeConditionByGroupAndConditionIds(
        params.groupId,
        params.conditionId,
      );

    if (!result) {
      throw new HttpError(500, "조건 추가가 정상적으로 이루어지지 않았습니다");
    } else {
      return "조건 추가가 완료되었습니다";
    }
  }
}
