import { Injectable, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcrypt";
import HttpError from "src/commons/httpError";

import { AuthRepository } from "src/repositories/auth.repository";
import { UserRepository } from "src/repositories/user.repository";
import { AuthService } from "../auth/auth.service";
import { CreateUserDto } from "./dto/request/create-user.dto";

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly authRepository: AuthRepository,
  ) {}

  // 회원가입
  async createUser(createUserDto: CreateUserDto) {
    // encode password
    const salt: string = await bcrypt.genSalt(10);
    const password: string = await bcrypt.hash(createUserDto.password, salt);
    createUserDto.password = password;

    const createdUser = await this.userRepository.createUser(createUserDto);
    return createdUser;
  }
  // 정보조회
  // 유저 정보 조회(패스워드를 제외한 전부)
  async getUserInfoAll(auth: string) {
    const data: any = await this.authRepository.validateToken(auth);
    const { _id } = data;
    if (!_id) throw new HttpError(401, "Unauthorized");
    return await this.userRepository.getUserDataById(_id);
  }

  // 비밀번호 변경
  async updatePassword(auth: string, new_password: string) {
    const data: any = await this.authRepository.validateToken(auth);
    const { _id } = data;
    if (!_id) throw new HttpError(401, "Unauthorized");
    // encode password
    const salt: string = await bcrypt.genSalt(10);
    const password: string = await bcrypt.hash(new_password, salt);
    return this.userRepository.updateUserPassword(_id, password);
  }

  // 회원탈퇴
  async remove(auth: string) {
    const data: any = await this.authRepository.validateToken(auth);
    const { _id } = data;
    if (!_id) throw new HttpError(401, "Unauthorized");
    return await this.userRepository.remove(_id);
  }
}
