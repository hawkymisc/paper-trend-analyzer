from app.database import engine
from app.models import Base

def create_db_tables():
    Base.metadata.create_all(bind=engine)
    print("Database tables created.")

if __name__ == "__main__":
    create_db_tables()