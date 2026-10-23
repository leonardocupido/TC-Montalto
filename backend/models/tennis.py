from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

MatchType = Literal["singolo", "doppio"]
MatchStatus = Literal["aperta", "confermata", "annullata"]
AppStatus = Literal["in_attesa", "accettata", "rifiutata"]


class RegisterIn(BaseModel):
    name: str = Field(min_length=2, max_length=60)
    email: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=6, max_length=100)
    phone: str = Field(default="", max_length=30)
    level: str = Field(default="", max_length=60)


class LoginIn(BaseModel):
    email: str
    password: str


class DemoUser(BaseModel):
    name: str
    email: str


class DemoLoginIn(BaseModel):
    email: str


class User(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    level: str


class MatchIn(BaseModel):
    type: MatchType
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    level: str = Field(min_length=1, max_length=80)
    notes: str = Field(default="", max_length=500)


class Player(BaseModel):
    user_id: str
    name: str
    level: str


class Match(BaseModel):
    id: str
    owner_id: str
    owner_name: str
    owner_level: str
    type: MatchType
    date: str
    time: str
    level: str
    notes: str
    status: MatchStatus
    spots_total: int
    spots_left: int
    players: list[Player]
    is_owner: bool
    my_application_status: Optional[AppStatus] = None
    pending_count: int
    created_at: datetime


class ApplyIn(BaseModel):
    phone: str = Field(min_length=3, max_length=30)
    message: str = Field(default="", max_length=300)


class Application(BaseModel):
    id: str
    match_id: str
    user_id: str
    user_name: str
    user_level: str
    phone: str
    message: str
    status: AppStatus
    applicant_seen: bool = True
    cancel_seen: bool = True
    created_at: datetime


class OwnedMatch(BaseModel):
    match: Match
    applications: list[Application]


class Contact(BaseModel):
    name: str
    phone: str
    role: Literal["proponente", "giocatore"]


class MyApplication(BaseModel):
    application: Application
    match: Match
    contacts: list[Contact]


class Summary(BaseModel):
    pending_reviews: int
    accepted_applications: int
    new_acceptances: int = 0
    new_cancellations: int = 0
    pending_challenges: int = 0
    challenge_updates: int = 0


ChallengeStatus = Literal["in_attesa", "accettata", "rifiutata"]


class ChallengeIn(BaseModel):
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    time: str = Field(pattern=r"^\d{2}:\d{2}$")
    message: str = Field(default="", max_length=300)


class Challenge(BaseModel):
    id: str
    challenger_id: str
    challenger_name: str
    challenger_level: str
    challenged_id: str
    challenged_name: str
    date: str
    time: str
    message: str
    status: ChallengeStatus
    expired: bool
    match_id: Optional[str] = None
    unseen: bool
    created_at: datetime


class ChallengeList(BaseModel):
    received: list[Challenge]
    sent: list[Challenge]


class History(BaseModel):
    last_30_days: int
    singoli: int
    doppi: int


class MemberSummary(BaseModel):
    id: str
    name: str
    level: str
    is_me: bool
    played_30d: int


class MemberStats(BaseModel):
    played_total: int
    played_30d: int
    singoli: int
    doppi: int
    proposed_total: int


class MemberDetail(BaseModel):
    id: str
    name: str
    email: str
    phone: str
    level: str
    member_since: Optional[datetime] = None
    is_me: bool
    stats: MemberStats
    upcoming: list[Match]
